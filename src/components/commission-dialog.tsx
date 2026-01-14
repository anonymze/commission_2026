import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import {
	AlertCircle,
	Calculator,
	CalendarIcon,
	ChevronsUpDown,
	Loader2,
	Save,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
	commissionImportUserQueryOptions,
	// createCommissionQuery,
	updateCommissionSupplierQuery,
} from "../api/queries/commission-queries";
import type { PaginatedResponse } from "../types/response";
import type { User } from "../types/user";

interface CreateCommissionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	users: PaginatedResponse<User>;
}

type ModifiedCommissionSupplier = {
	id: string;
	supplier: {
		id: string;
		name: string;
	};
	production: number;
	encours: number;
	sheet_lines: Array<{
		rowIndex: number;
		subcode: string;
		amount: number;
		verificationKeyword: string;
		fullRow: any[];
		type?: "production" | "encours";
	}>;
};

export default function CreateCommissionDialog({
	open,
	onOpenChange,
	users,
}: CreateCommissionDialogProps) {
	const { queryClient } = useRouteContext({ from: "/_authed/dashboard" });
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
		null,
	);
	const [modifiedSuppliers, setModifiedSuppliers] = useState<
		ModifiedCommissionSupplier[]
	>([]);

	const updateSupplier = useMutation({
		mutationFn: updateCommissionSupplierQuery,
	});

	// const createCommission = useMutation({
	// 	mutationFn: createCommissionQuery,
	// 	onSuccess: () => {
	// 		queryClient.invalidateQueries({ queryKey: ["commissions"] });
	// 		toast.success("Commission créée avec succès");
	// 		onOpenChange(false);
	// 	},
	// 	onError: (_) => {
	// 		toast.error(
	// 			"Une erreur est survenue lors de la création de la commission, recommencez ou contactez le développeur",
	// 		);
	// 		form.setFieldValue("app_user", null);
	// 		setSelectedEmployeeId(null);
	// 		// onOpenChange(false);
	// 	},
	// });

	const form = useForm({
		defaultValues: {
			app_user: null as User | null,
			date: new Date(),
		},
		onSubmit: async ({ value }) => {
			const { app_user } = value;

			if (!app_user) {
				return toast.error("Veuillez sélectionner un employé");
			}

			if (!commissionImportUser || commissionImportUser.status !== "success") {
				return toast.error("Aucune donnée de commission disponible");
			}

			try {
				// Update all commission suppliers with modified data
				await Promise.all(
					modifiedSuppliers.map((supplier) => {
						const productionTotal = supplier.sheet_lines
							.filter((line) => {
								if (line.type) return line.type === "production";
								return supplier.production > 0 || supplier.encours === 0;
							})
							.reduce((sum, line) => sum + line.amount, 0);
						const encoursTotal = supplier.sheet_lines
							.filter((line) => {
								if (line.type) return line.type === "encours";
								return supplier.encours > 0 && supplier.production === 0;
							})
							.reduce((sum, line) => sum + line.amount, 0);
						return updateSupplier.mutateAsync({
							data: {
								id: supplier.id,
								production: productionTotal,
								encours: encoursTotal,
								sheet_lines: supplier.sheet_lines,
							},
						});
					}),
				);

				// Invalidate commissions list and close (don't refetch commission-import-user to avoid duplicate)
				await queryClient.invalidateQueries({ queryKey: ["commissions"] });

				toast.success("Commission mise à jour avec succès");
				onOpenChange(false);
			} catch (error) {
				toast.error("Erreur lors de la mise à jour");
				console.error(error);
			}
		},
	});

	const {
		data: commissionImportUser,
		isLoading: loadingCommissions,
		isFetching,
		// isError,
		// error: errorCommissions,
	} = useQuery({
		...commissionImportUserQueryOptions(selectedEmployeeId || ""),
	});

	// Initialize modifiedSuppliers when commission data is loaded
	useEffect(() => {
		if (commissionImportUser && commissionImportUser.status === "success") {
			setModifiedSuppliers(commissionImportUser.data.commissionSuppliers);
			// Backend creates commission when loading data, invalidate to show on table
			queryClient.invalidateQueries({ queryKey: ["commissions"] });
		}
	}, [commissionImportUser, queryClient]);

	// Calculate totals from modified suppliers
	const calculatedTotals = useMemo(() => {
		const production = modifiedSuppliers.reduce(
			(sum, s) =>
				sum +
				s.sheet_lines
					.filter((line) => {
						// Use type field if available, otherwise fallback to supplier values
						if (line.type) return line.type === "production";
						return s.production > 0 || s.encours === 0;
					})
					.reduce((lineSum, line) => lineSum + line.amount, 0),
			0,
		);
		const encours = modifiedSuppliers.reduce(
			(sum, s) =>
				sum +
				s.sheet_lines
					.filter((line) => {
						// Use type field if available, otherwise fallback to supplier values
						if (line.type) return line.type === "encours";
						return s.encours > 0 && s.production === 0;
					})
					.reduce((lineSum, line) => lineSum + line.amount, 0),
			0,
		);
		return { production, encours };
	}, [modifiedSuppliers]);

	const handleEmployeeChange = (userId: User["id"]) => {
		const user = users?.docs.find((u) => u.id === userId);
		if (user) {
			form.setFieldValue("app_user", user);
			setSelectedEmployeeId(user.id);
			// Validate the employee field to clear errors
			form.validateField("app_user", "change");
		}
		setPopoverOpen(false);
	};

	const handleAmountChange = (
		supplierIndex: number,
		lineRowIndex: number,
		newAmount: string,
	) => {
		const amount = Number.parseFloat(newAmount) || 0;
		setModifiedSuppliers((prev) => {
			const updated = [...prev];
			const lineIndex = updated[supplierIndex].sheet_lines.findIndex(
				(line) => line.rowIndex === lineRowIndex,
			);
			if (lineIndex !== -1) {
				updated[supplierIndex].sheet_lines[lineIndex].amount = amount;
			}
			return updated;
		});
	};

	const handleDeleteRow = (supplierIndex: number, lineRowIndex: number) => {
		setModifiedSuppliers((prev) => {
			const updated = [...prev];
			updated[supplierIndex].sheet_lines = updated[
				supplierIndex
			].sheet_lines.filter((line) => line.rowIndex !== lineRowIndex);
			return updated;
		});
	};

	// Reset dialog state when closing
	useEffect(() => {
		if (!open) {
			setSelectedEmployeeId(null);
			setModifiedSuppliers([]);
			form.reset();
		}
	}, [open, form]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Calculator className="w-5 h-5" />
						Créer une commission
					</DialogTitle>
					<DialogDescription>
						Créez un nouvel enregistrement de commission pour un employé.
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="flex-1 flex flex-col overflow-hidden"
				>
					<div className="flex-1 overflow-y-auto p-0 space-y-4">
						{/* Employee & Date Selection - Always visible */}
						<Card>
							<CardContent className="space-y-4">
							{/* Period Field */}
							<form.Field
								name="date"
								validators={{
									onChange: validatePeriod,
								}}
							>
								{(field) => (
									<div className="space-y-2">
										<Label>
											Mois de commission{" "}
											<span className="text-red-500">*</span>
										</Label>
										<Popover
											open={calendarOpen}
											onOpenChange={setCalendarOpen}
										>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className={cn(
														"w-full justify-start text-left font-normal",
														!field.state.value && "text-muted-foreground",
														field.state.meta.errors.length > 0 &&
															"border-red-500",
													)}
												>
													<CalendarIcon className="mr-2 h-4 w-4" />
													{field.state.value
														? field.state.value.toLocaleDateString("fr-FR", {
																month: "2-digit",
																year: "numeric",
															})
														: "Sélectionner le mois"}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													mode="single"
													selected={field.state.value}
													onSelect={(date) => {
														if (date) {
															field.handleChange(date);
															setCalendarOpen(false);
														}
													}}
												/>
											</PopoverContent>
										</Popover>
										{field.state.meta.errors.length > 0 && (
											<p className="text-sm text-red-500">
												{field.state.meta.errors[0]}
											</p>
										)}
									</div>
								)}
							</form.Field>
								{/* Employee Field */}
								<form.Field
									name="app_user"
									validators={{
										onChange: validateUser,
									}}
								>
									{(field) => (
										<div className="space-y-2.5">
											<Label htmlFor="user-select">
												Sélectionner pour quel utilisateur{" "}
												<span className="text-red-500">*</span>
											</Label>
											<Popover
												open={popoverOpen}
												onOpenChange={setPopoverOpen}
												modal={true}
											>
												<PopoverTrigger asChild>
													<Button
														variant="outline"
														role="combobox"
														aria-expanded={popoverOpen}
														className="w-full justify-between"
													>
														{field.state.value
															? field.state.value.email
															: "Choisir un utilisateur..."}
														<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-[250px] p-0">
													<Command>
														<CommandInput placeholder="Rechercher un utilisateur..." />
														<CommandEmpty>
															Aucun utilisateur disponible
														</CommandEmpty>
														<CommandGroup className="max-h-[230px] overflow-auto">
															{users?.docs?.map((user) => {
																const fullName =
																	`${user.firstname || ""} ${user.lastname || ""}`.trim();
																const displayName = fullName || user.email;
																return (
																	<CommandItem
																		key={user.id}
																		value={`${fullName} ${user.email}`}
																		onSelect={() =>
																			handleEmployeeChange(user.id)
																		}
																	>
																		<div className="flex flex-col">
																			<span className="font-medium">
																				{displayName}
																			</span>
																			{fullName && (
																				<span className="text-xs text-gray-500">
																					{user.email}
																				</span>
																			)}
																		</div>
																	</CommandItem>
																);
															}) || []}
														</CommandGroup>
													</Command>
												</PopoverContent>
											</Popover>
											{field.state.meta.errors.length > 0 && (
												<p className="text-sm text-red-500">
													{field.state.meta.errors[0]}
												</p>
											)}
										</div>
									)}
								</form.Field>
							</CardContent>
						</Card>

						{/* Loading State - Show during initial load OR refetch */}
						{(loadingCommissions || isFetching) && (
							<Card>
								<CardContent className="flex items-center justify-center py-8">
									<div className="flex flex-col items-center gap-3">
										<Loader2 className="h-8 w-8 animate-spin text-blue-600" />
										<p className="text-sm text-gray-600">
											Chargement des calculs de commission...
										</p>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Error State (hide during loading/refetch) */}
						{commissionImportUser &&
							commissionImportUser.status === "error" &&
							!isFetching && (
								<Card className="border-red-200">
									<CardHeader>
										<CardTitle className="text-lg flex items-center gap-2 text-red-600">
											<AlertCircle className="w-5 h-5" />
											Erreur
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										<p className="text-sm">{commissionImportUser.message}</p>
										{commissionImportUser.errors && (
											<ul className="list-disc list-inside text-sm text-red-600 space-y-1">
												{commissionImportUser.errors.map((err, i) => (
													<li key={i}>{err}</li>
												))}
											</ul>
										)}
									</CardContent>
								</Card>
							)}

						{/* Success State - Commission Data (hide during refetch) */}
						{commissionImportUser &&
							commissionImportUser.status === "success" &&
							selectedEmployeeId &&
							!isFetching && (
								<>
									{/* Global Totals */}
									<Card>
										<CardHeader>
											<CardTitle className="text-lg">Totaux Globaux</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="grid grid-cols-2 gap-4">
												<div className="space-y-2">
													<Label>Production</Label>
													<div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
														<span className="text-2xl font-bold text-orange-600">
															{calculatedTotals.production.toFixed(2)}€
														</span>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Encours</Label>
													<div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
														<span className="text-2xl font-bold text-blue-600">
															{calculatedTotals.encours.toFixed(2)}€
														</span>
													</div>
												</div>
											</div>
										</CardContent>
									</Card>

									{/* Suppliers Tables */}
									{modifiedSuppliers.map((supplier, supplierIndex) => {
										const supplierProductionTotal = supplier.sheet_lines
											.filter((line) => {
												if (line.type) return line.type === "production";
												return supplier.production > 0 || supplier.encours === 0;
											})
											.reduce((sum, line) => sum + line.amount, 0);
										const supplierEncoursTotal = supplier.sheet_lines
											.filter((line) => {
												if (line.type) return line.type === "encours";
												return supplier.encours > 0 && supplier.production === 0;
											})
											.reduce((sum, line) => sum + line.amount, 0);

										return (
											<Card key={supplier.id}>
												<CardHeader>
													<CardTitle className="text-lg">
														{supplier.supplier.name}
													</CardTitle>
													<div className="flex gap-4 text-sm">
														<span>
															Production:{" "}
															<strong>
																{supplierProductionTotal.toFixed(2)}€
															</strong>
														</span>
														<span>
															Encours:{" "}
															<strong>{supplierEncoursTotal.toFixed(2)}€</strong>
														</span>
													</div>
												</CardHeader>
												<CardContent>
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>Ligne</TableHead>
																<TableHead>Type</TableHead>
																<TableHead>Sous-code</TableHead>
																<TableHead>Vérification</TableHead>
																<TableHead>Montant</TableHead>
																<TableHead className="w-[100px]">
																	Actions
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{supplier.sheet_lines.map((line) => {
																const isProduction = line.type
																	? line.type === "production"
																	: supplier.production > 0 || supplier.encours === 0;
																return (
																	<TableRow
																		key={`${supplier.id}-${line.rowIndex}`}
																	>
																		<TableCell>{line.rowIndex + 1}</TableCell>
																		<TableCell>
																			<span
																				className={`font-semibold ${isProduction ? "text-red-600" : "text-blue-600"}`}
																			>
																				{isProduction ? "Production" : "Encours"}
																			</span>
																		</TableCell>
																		<TableCell>{line.subcode}</TableCell>
																		<TableCell className="max-w-[200px] truncate">
																			{line.verificationKeyword}
																		</TableCell>
																	<TableCell>
																		<Input
																			type="number"
																			step="0.01"
																			value={line.amount}
																			onChange={(e) =>
																				handleAmountChange(
																					supplierIndex,
																					line.rowIndex,
																					e.target.value,
																				)
																			}
																			className="w-32"
																		/>
																	</TableCell>
																	<TableCell>
																		<Button
																			type="button"
																			variant="ghost"
																			size="sm"
																			onClick={() =>
																				handleDeleteRow(supplierIndex, line.rowIndex)
																			}
																		>
																			<Trash2 className="w-4 h-4 text-red-500" />
																		</Button>
																	</TableCell>
																</TableRow>
																);
															})}
														</TableBody>
													</Table>
												</CardContent>
											</Card>
										);
									})}
								</>
							)}
					</div>

					{/* Action Buttons */}
					<div className="flex items-center justify-between p-4 border-t bg-gray-50">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							<X className="w-4 h-4 mr-2" />
							Fermer
						</Button>
						<Button
							type="submit"
							disabled={
								form.state.isSubmitting ||
								loadingCommissions ||
								!commissionImportUser ||
								commissionImportUser.status === "error"
							}
						>
							{form.state.isSubmitting ? (
								<>
									<Calculator className="w-4 h-4 mr-2 animate-spin" />
									Mise à jour...
								</>
							) : (
								<>
									<Save className="w-4 h-4 mr-2" />
									Mettre à jour
								</>
							)}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

const validateUser = ({ value }: { value: User | null }) => {
	if (!value) return "L'employé est requis";
	return undefined;
};

const validatePeriod = ({ value }: { value: Date | undefined }) => {
	if (!value) return "Le mois est requis";
	return undefined;
};
