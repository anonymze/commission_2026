import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import {
	AlertCircle,
	Calculator,
	ChevronsUpDown,
	Loader2,
	Save,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	generateCommission,
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
		source?: "pdf";
	}>;
};

export default function CreateCommissionDialog({
	open,
	onOpenChange,
	users,
}: CreateCommissionDialogProps) {
	const { queryClient } = useRouteContext({ from: "/_authed/dashboard" });
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
		null,
	);
	const [modifiedSuppliers, setModifiedSuppliers] = useState<
		ModifiedCommissionSupplier[]
	>([]);

	const [replacement, setReplacement] = useState<{
		userId: string;
		month: string;
		replaceId: string;
	} | null>(null);

	const updateSupplier = useMutation({
		mutationFn: updateCommissionSupplierQuery,
	});

	const form = useForm({
		defaultValues: {
			app_user: null as User | null,
			month: currentMonth(),
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
					modifiedSuppliers
						.filter(
							(supplier) =>
								!supplier.sheet_lines.some((line) => line.source === "pdf"),
						)
						.map((supplier) => {
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

				// Refresh the list after saving edits.
				await queryClient.invalidateQueries({ queryKey: ["commissions"] });

				toast.success("Commission mise à jour avec succès");
				onOpenChange(false);
			} catch (error) {
				toast.error("Erreur lors de la mise à jour");
				console.error(error);
			}
		},
	});

	const generation = useMutation({
		mutationFn: generateCommission,
		retry: false,
		onSuccess: (result, variables) => {
			if (result.status === "error") {
				setReplacement(null);
				if (
					result.code === "MONTHLY_COMMISSION_EXISTS" &&
					result.existingCommissionId
				) {
					setReplacement({
						...variables.data,
						replaceId: result.existingCommissionId,
					});
				}
				return;
			}
			setReplacement(null);
			setModifiedSuppliers(result.data.commissionSuppliers);
			void queryClient.invalidateQueries({ queryKey: ["commissions"] });
		},
		onError: () => toast.error("Impossible de générer la commission"),
	});
	const commissionImportUser = generation.data;
	const loadingCommissions = generation.isPending;
	const selectionLocked =
		loadingCommissions ||
		!!replacement ||
		commissionImportUser?.status === "success";

	const handleGenerate = () => {
		const { app_user, month } = form.state.values;
		if (selectionLocked || !app_user || validatePeriod({ value: month }))
			return;
		generation.mutate({ data: { userId: app_user.id, month } });
	};

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
			if (
				lineIndex !== -1 &&
				updated[supplierIndex].sheet_lines[lineIndex].source !== "pdf"
			) {
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
			].sheet_lines.filter(
				(line) => line.source === "pdf" || line.rowIndex !== lineRowIndex,
			);
			return updated;
		});
	};

	// Reset dialog state when closing
	useEffect(() => {
		if (!open) {
			generation.reset();
			setReplacement(null);
			setSelectedEmployeeId(null);
			setModifiedSuppliers([]);
			form.reset({ app_user: null, month: currentMonth() });
		}
	}, [open, form, generation.reset]);

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!loadingCommissions) onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[90vw] sm:max-w-[90vw] h-[90dvh] flex flex-col gap-4 p-4 sm:p-6">
				<DialogHeader className="shrink-0 pr-6 text-left">
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
					className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden"
				>
					<div className="min-h-0 min-w-0 flex-1 overflow-y-auto space-y-4 pb-4 [scrollbar-gutter:stable] [color-scheme:light] dark:[color-scheme:dark]">
						{/* Employee & Month Selection */}
						<Card>
							<CardContent className="space-y-4 px-4 sm:px-6">
								<form.Field
									name="month"
									validators={{ onChange: validatePeriod }}
								>
									{(field) => (
										<div className="space-y-2">
											<Label htmlFor="commission-month">
												Mois des commissions{" "}
												<span className="text-red-500">*</span>
											</Label>
											<Input
												id="commission-month"
												type="month"
												required
												min="1000-01"
												max="9999-12"
												value={field.state.value}
												disabled={selectionLocked}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												aria-describedby="commission-month-help"
											/>
											<p
												id="commission-month-help"
												className="text-xs text-muted-foreground"
											>
												Choisissez le mois concerné par les fichiers importés.
											</p>
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
														id="user-select"
														type="button"
														disabled={selectionLocked}
														role="combobox"
														aria-expanded={popoverOpen}
														className="w-full justify-between"
													>
														<span className="min-w-0 truncate">
															{field.state.value
																? field.state.value.email
																: "Choisir un utilisateur..."}
														</span>
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
																				<span className="text-xs text-muted-foreground">
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
								{commissionImportUser?.status !== "success" && !replacement && (
									<form.Subscribe
										selector={(state) =>
											[state.values.app_user, state.values.month] as const
										}
									>
										{([user, month]) => (
											<Button
												type="button"
												onClick={handleGenerate}
												disabled={
													!user ||
													!!validatePeriod({ value: month }) ||
													loadingCommissions
												}
											>
												{loadingCommissions ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<Calculator className="size-4" />
												)}
												{loadingCommissions
													? "Génération…"
													: "Générer la commission"}
											</Button>
										)}
									</form.Subscribe>
								)}
							</CardContent>
						</Card>

						{replacement && (
							<div
								role="alert"
								className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
							>
								<p className="text-sm font-medium">
									Une synthèse existe déjà pour{" "}
									{new Date(
										`${replacement.month}-01T00:00:00Z`,
									).toLocaleDateString("fr-FR", {
										month: "long",
										year: "numeric",
										timeZone: "UTC",
									})}
									.
								</p>
								<p className="text-sm">
									La nouvelle synthèse remplacera celle de cet indépendant pour
									ce mois. L’ancienne restera consultable dans les archives et
									sera exclue du cumul annuel.
								</p>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										size="sm"
										disabled={loadingCommissions}
										onClick={() => generation.mutate({ data: replacement })}
									>
										{loadingCommissions
											? "Remplacement…"
											: "Confirmer le remplacement"}
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										disabled={loadingCommissions}
										onClick={() => {
											setReplacement(null);
											generation.reset();
										}}
									>
										Annuler
									</Button>
								</div>
							</div>
						)}

						{/* Loading State - Show during initial load OR refetch */}
						{loadingCommissions && (
							<Card>
								<CardContent className="flex items-center justify-center py-8">
									<div className="flex flex-col items-center gap-3">
										<Loader2 className="h-8 w-8 animate-spin text-blue-600" />
										<p className="text-sm text-muted-foreground">
											Chargement des calculs de commission...
										</p>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Error State (hide during loading/refetch) */}
						{commissionImportUser &&
							commissionImportUser.status === "error" &&
							!replacement &&
							!loadingCommissions && (
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
							!loadingCommissions && (
								<>
									{/* Global Totals */}
									<Card>
										<CardHeader>
											<CardTitle className="text-lg">Totaux Globaux</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
												<div className="space-y-2">
													<Label>Production</Label>
													<div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-900">
														<span className="text-2xl font-bold tabular-nums break-all text-orange-600 dark:text-orange-400">
															{calculatedTotals.production.toFixed(2)}€
														</span>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Encours</Label>
													<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
														<span className="text-2xl font-bold tabular-nums break-all text-blue-600 dark:text-blue-400">
															{calculatedTotals.encours.toFixed(2)}€
														</span>
													</div>
												</div>
											</div>
										</CardContent>
									</Card>

									{/* Suppliers Tables */}
									<Accordion type="multiple" className="space-y-2">
										{modifiedSuppliers.map((supplier, supplierIndex) => {
											const supplierProductionTotal = supplier.sheet_lines
												.filter((line) => {
													if (line.type) return line.type === "production";
													return (
														supplier.production > 0 || supplier.encours === 0
													);
												})
												.reduce((sum, line) => sum + line.amount, 0);
											const supplierEncoursTotal = supplier.sheet_lines
												.filter((line) => {
													if (line.type) return line.type === "encours";
													return (
														supplier.encours > 0 && supplier.production === 0
													);
												})
												.reduce((sum, line) => sum + line.amount, 0);

											return (
												<AccordionItem
													key={supplier.id}
													value={supplier.id}
													className="min-w-0 border rounded-lg px-3 sm:px-4 last:border-b"
												>
													<AccordionTrigger className="min-w-0 hover:no-underline">
														<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 text-left">
															<span className="basis-full break-words font-semibold sm:basis-auto">
																{supplier.supplier.name}
															</span>
															<span className="text-sm text-muted-foreground">
																Production:{" "}
																<strong className="text-red-600 dark:text-red-400">
																	{supplierProductionTotal.toFixed(2)}€
																</strong>
															</span>
															<span className="text-sm text-muted-foreground">
																Encours:{" "}
																<strong className="text-blue-600 dark:text-blue-400">
																	{supplierEncoursTotal.toFixed(2)}€
																</strong>
															</span>
															<span className="text-sm text-muted-foreground">
																{supplier.sheet_lines.length} ligne
																{supplier.sheet_lines.length !== 1 ? "s" : ""}
															</span>
														</div>
													</AccordionTrigger>
													<AccordionContent>
														{supplier.sheet_lines.some(
															(line) => line.source === "pdf",
														) && (
															<p className="mb-3 text-sm text-muted-foreground">
																PDF validé · Lecture seule. Pour corriger ces
																données, modifiez le relevé dans Imports,
																validez-le puis recréez la commission.
															</p>
														)}
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
																		: supplier.production > 0 ||
																			supplier.encours === 0;
																	return (
																		<TableRow
																			key={`${supplier.id}-${line.rowIndex}`}
																		>
																			<TableCell>{line.rowIndex + 1}</TableCell>
																			<TableCell>
																				<span
																					className={`font-semibold ${isProduction ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
																				>
																					{isProduction
																						? "Production"
																						: "Encours"}
																				</span>
																			</TableCell>
																			<TableCell>{line.subcode}</TableCell>
																			<TableCell className="max-w-[200px] truncate">
																				{line.verificationKeyword}
																			</TableCell>
																			<TableCell>
																				{line.source === "pdf" ? (
																					<span className="whitespace-nowrap tabular-nums">
																						{line.amount.toFixed(2)} €
																					</span>
																				) : (
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
																				)}
																			</TableCell>
																			<TableCell>
																				{line.source === "pdf" ? (
																					<span className="whitespace-nowrap text-xs text-muted-foreground">
																						PDF · Lecture seule
																					</span>
																				) : (
																					<Button
																						type="button"
																						variant="ghost"
																						size="sm"
																						onClick={() =>
																							handleDeleteRow(
																								supplierIndex,
																								line.rowIndex,
																							)
																						}
																					>
																						<Trash2 className="w-4 h-4 text-red-500" />
																					</Button>
																				)}
																			</TableCell>
																		</TableRow>
																	);
																})}
															</TableBody>
														</Table>
													</AccordionContent>
												</AccordionItem>
											);
										})}
									</Accordion>
								</>
							)}
					</div>

					{/* Action Buttons */}
					<div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-muted/50 p-3 sm:p-4">
						<Button
							type="submit"
							disabled={
								form.state.isSubmitting ||
								!modifiedSuppliers.some(
									(supplier) =>
										!supplier.sheet_lines.some((line) => line.source === "pdf"),
								) ||
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
						<Button
							type="button"
							variant="outline"
							disabled={loadingCommissions}
							onClick={() => onOpenChange(false)}
						>
							<X className="w-4 h-4 mr-2" />
							Fermer
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

const validatePeriod = ({ value }: { value: string }) => {
	if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value))
		return "Choisissez un mois valide";
	return undefined;
};

function currentMonth() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
