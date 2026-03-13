import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BookAlertIcon,
	Check,
	ChevronsUpDown,
	FileSpreadsheetIcon,
	SaveIcon,
	Search,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	createSupplierCommissionColumnQuery,
	deleteSupplierCommissionColumnQuery,
	supplierCommissionsColumnQueryOptions,
	updateSupplierCommissionColumnQuery,
} from "@/api/queries/commission-queries";
import { suppliersQueryOptions } from "@/api/queries/supplier-queries";
import { TabSkeleton } from "@/components/tab-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/supplier-column-mapping")({
	component: SupplierColumnMappingTab,
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(suppliersQueryOptions()),
			context.queryClient.ensureQueryData(
				supplierCommissionsColumnQueryOptions(),
			),
		]);
	},
	pendingComponent: () => <TabSkeleton />,
});

type SupplierEntry = {
	id?: string;
	production?: {
		subcode_column: string;
		verification_column: string;
		amount_column: string;
	};
	encours?: {
		subcode_column: string;
		verification_column: string;
		amount_column: string;
	};
	production_encours?: {
		production_subcode_column: string;
		production_verification_column: string;
		production_amount_column: string;
		encours_subcode_column: string;
		encours_verification_column: string;
		encours_amount_column: string;
	};
};

function SupplierColumnMappingTab() {
	const { queryClient } = Route.useRouteContext();

	const { data: suppliersData } = useSuspenseQuery(suppliersQueryOptions());
	const { data: existingColumns } = useSuspenseQuery(
		supplierCommissionsColumnQueryOptions(),
	);

	const allSuppliers = suppliersData.docs || [];
	const existingColumnMappings = existingColumns.docs || [];

	// State: Record<supplierId, SupplierEntry>
	const [supplierEntries, setSupplierEntries] = useState<
		Record<string, SupplierEntry>
	>({});

	// Supplier selector state
	const [supplierOpen, setSupplierOpen] = useState(false);

	// Search state
	const [searchQuery, setSearchQuery] = useState("");

	// Initialize state from existing data (only on mount)
	const [isInitialized, setIsInitialized] = useState(false);

	useMemo(() => {
		if (isInitialized) return;

		const initial: Record<string, SupplierEntry> = {};

		existingColumnMappings.forEach((col) => {
			const supplierId =
				typeof col.supplier === "string" ? col.supplier : col.supplier.id;

			initial[supplierId] = {
				id: col.id,
				production: col.production
					? {
							subcode_column: col.production.subcode_column || "",
							verification_column: col.production.verification_column || "",
							amount_column: col.production.amount_column || "",
						}
					: undefined,
				encours: col.encours
					? {
							subcode_column: col.encours.subcode_column || "",
							verification_column: col.encours.verification_column || "",
							amount_column: col.encours.amount_column || "",
						}
					: undefined,
				production_encours: col.production_encours
					? {
							production_subcode_column:
								col.production_encours.production_subcode_column || "",
							production_verification_column:
								col.production_encours.production_verification_column || "",
							production_amount_column:
								col.production_encours.production_amount_column || "",
							encours_subcode_column:
								col.production_encours.encours_subcode_column || "",
							encours_verification_column:
								col.production_encours.encours_verification_column || "",
							encours_amount_column:
								col.production_encours.encours_amount_column || "",
						}
					: undefined,
			};
		});

		setSupplierEntries(initial);
		setIsInitialized(true);
	}, [existingColumnMappings, isInitialized]);

	// Create mutation
	const createMutation = useMutation({
		mutationFn: createSupplierCommissionColumnQuery,
		onSuccess: (data, variables) => {
			// Update local state with the new ID
			const supplierId = variables.data.supplier;
			setSupplierEntries((prev) => ({
				...prev,
				[supplierId]: {
					...prev[supplierId],
					id: data.doc.id,
				},
			}));

			queryClient.invalidateQueries({
				queryKey: ["supplier-commissions-column"],
			});
			toast.success("Mapping créé avec succès");
		},
		onError: () => {
			toast.error("Erreur lors de la création du mapping");
		},
	});

	// Update mutation
	const updateMutation = useMutation({
		mutationFn: updateSupplierCommissionColumnQuery,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["supplier-commissions-column"],
			});
			toast.success("Mapping mis à jour avec succès");
		},
		onError: () => {
			toast.error("Erreur lors de la mise à jour du mapping");
		},
	});

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: deleteSupplierCommissionColumnQuery,
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["supplier-commissions-column"],
			});

			// Remove from local state
			const deletedId = variables.data;
			setSupplierEntries((prev) => {
				const updated = { ...prev };
				for (const supplierId in updated) {
					if (updated[supplierId].id === deletedId) {
						delete updated[supplierId];
						break;
					}
				}
				return updated;
			});

			toast.success("Mapping supprimé avec succès");
		},
		onError: () => {
			toast.error("Erreur lors de la suppression du mapping");
		},
	});

	// Handle supplier selection
	const handleSelectSupplier = (supplierId: string) => {
		if (!supplierEntries[supplierId]) {
			// Initialize with empty structure
			setSupplierEntries((prev) => ({
				...prev,
				[supplierId]: {
					production: {
						subcode_column: "",
						verification_column: "",
						amount_column: "",
					},
					encours: {
						subcode_column: "",
						verification_column: "",
						amount_column: "",
					},
					production_encours: {
						production_subcode_column: "",
						production_verification_column: "",
						production_amount_column: "",
						encours_subcode_column: "",
						encours_verification_column: "",
						encours_amount_column: "",
					},
				},
			}));
		}
		setSupplierOpen(false);
	};

	// Update field
	const updateField = (
		supplierId: string,
		section: "production" | "encours" | "production_encours",
		field: string,
		value: string,
	) => {
		setSupplierEntries((prev) => {
			const currentSection = prev[supplierId]?.[section] || {};

			return {
				...prev,
				[supplierId]: {
					...prev[supplierId],
					[section]: {
						...currentSection,
						[field]: value,
					},
				},
			};
		});
	};

	// Save supplier mappings
	const saveSupplierMapping = async (supplierId: string) => {
		const entry = supplierEntries[supplierId];
		if (!entry) return;

		// Build payload
		const payload: any = {
			supplier: supplierId,
		};

		// Check if section has any values
		const hasProductionValues =
			entry.production?.subcode_column ||
			entry.production?.verification_column ||
			entry.production?.amount_column;
		const hasEncoursValues =
			entry.encours?.subcode_column ||
			entry.encours?.verification_column ||
			entry.encours?.amount_column;
		const hasProductionEncoursValues =
			entry.production_encours?.production_verification_column ||
			entry.production_encours?.production_subcode_column ||
			entry.production_encours?.production_amount_column ||
			entry.production_encours?.encours_verification_column ||
			entry.production_encours?.encours_subcode_column ||
			entry.production_encours?.encours_amount_column;

		// Production (verification_column not required)
		if (hasProductionValues) {
			if (
				!entry.production?.subcode_column ||
				!entry.production?.amount_column
			) {
				toast.error("Production: sous-code et montant requis");
				return;
			}
			payload.production = entry.production;
		} else if (entry.id) {
			// Send empty object to clear (only if updating existing)
			payload.production = {
				subcode_column: null,
				verification_column: null,
				amount_column: null,
			};
		}

		// Encours (verification_column not required)
		if (hasEncoursValues) {
			if (!entry.encours?.subcode_column || !entry.encours?.amount_column) {
				toast.error("Encours: sous-code et montant requis");
				return;
			}
			payload.encours = entry.encours;
		} else if (entry.id) {
			// Send empty object to clear (only if updating existing)
			payload.encours = {
				subcode_column: null,
				verification_column: null,
				amount_column: null,
			};
		}

		// Production + Encours
		if (hasProductionEncoursValues) {
			if (
				!entry.production_encours?.production_verification_column ||
				!entry.production_encours?.production_subcode_column ||
				!entry.production_encours?.production_amount_column ||
				!entry.production_encours?.encours_verification_column ||
				!entry.production_encours?.encours_subcode_column ||
				!entry.production_encours?.encours_amount_column
			) {
				toast.error("Production+Encours: tous les champs requis");
				return;
			}
			payload.production_encours = entry.production_encours;
		} else if (entry.id) {
			// Send empty object to clear (only if updating existing)
			payload.production_encours = {
				production_verification_column: null,
				production_subcode_column: null,
				production_amount_column: null,
				encours_verification_column: null,
				encours_subcode_column: null,
				encours_amount_column: null,
			};
		}

		// At least one section must be filled
		if (
			!payload.production &&
			!payload.encours &&
			!payload.production_encours
		) {
			toast.error("Veuillez remplir au moins une section");
			return;
		}

		// Debug: log what we're sending
		console.log("Saving supplier mapping:", {
			supplierId,
			payload,
		});

		if (entry.id) {
			// Update
			await updateMutation.mutateAsync({
				data: {
					...payload,
					supplierColumnId: entry.id,
				},
			});
		} else {
			// Create
			await createMutation.mutateAsync({ data: payload });
		}
	};

	// Remove supplier
	const removeSupplier = (supplierId: string) => {
		setSupplierEntries((prev) => {
			const { [supplierId]: removed, ...rest } = prev;
			return rest;
		});
	};

	// Available suppliers
	const availableSuppliers = allSuppliers.filter(
		(supplier) => !supplierEntries[supplier.id],
	);

	// Smart sorting + filtering by search
	const sortedSupplierIds = useMemo(() => {
		const supplierIds = Object.keys(supplierEntries);
		const existingIds = new Set(
			existingColumnMappings
				.map((col) =>
					typeof col.supplier === "string" ? col.supplier : col.supplier.id,
				)
				.filter(Boolean),
		);

		const newlyAdded = supplierIds.filter((id) => !existingIds.has(id));
		const existing = supplierIds.filter((id) => existingIds.has(id));

		const sortedExisting = existing.sort((a, b) => {
			const supplierA = allSuppliers.find((s) => s.id === a);
			const supplierB = allSuppliers.find((s) => s.id === b);
			const nameA = (supplierA?.name || "").toLowerCase();
			const nameB = (supplierB?.name || "").toLowerCase();
			return nameA.localeCompare(nameB);
		});

		const allSorted = [...newlyAdded, ...sortedExisting];

		// Filter by search query
		if (!searchQuery.trim()) return allSorted;

		const lowerQuery = searchQuery.toLowerCase();
		return allSorted.filter((id) => {
			const supplier = allSuppliers.find((s) => s.id === id);
			return supplier?.name.toLowerCase().includes(lowerQuery);
		});
	}, [supplierEntries, allSuppliers, existingColumnMappings, searchQuery]);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="gap-0">
					<div className="flex items-center justify-between gap-2">
						<div className="flex flex-col gap-2">
							<CardTitle className="flex items-center gap-2">
								<FileSpreadsheetIcon className="w-5 h-5" />
								Mapping Colonnes Fournisseurs
							</CardTitle>
							<CardDescription>
								Gérez les colonnes d'import pour chaque fournisseur (production,
								encours, production-encours).
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert className="items-center">
						<BookAlertIcon className="h-4 w-4" />
						<AlertDescription>
							Chaque fournisseur peut avoir 3 types d'entrées : Production,
							Encours, et Production-Encours. Spécifiez les colonnes pour
							"sous-code" et "Montant" pour chaque type.
						</AlertDescription>
					</Alert>

					{/* Supplier Selector & Search */}
					<div className="flex items-center justify-between gap-4">
						<Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									role="combobox"
									aria-expanded={supplierOpen}
									className="w-[300px] justify-between"
								>
									Sélectionner un fournisseur...
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-[300px] p-0">
								<Command>
									<CommandInput placeholder="Rechercher un fournisseur..." />
									<CommandList>
										<CommandEmpty>Aucun fournisseur trouvé.</CommandEmpty>
										<CommandGroup>
											{availableSuppliers.map((supplier) => (
												<CommandItem
													key={supplier.id}
													value={supplier.name}
													onSelect={() => handleSelectSupplier(supplier.id)}
												>
													<Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
													{supplier.name}
												</CommandItem>
											))}
										</CommandGroup>
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>

						{Object.keys(supplierEntries).length > 0 && (
							<div className="relative w-[300px]">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
								<Input
									placeholder="Rechercher..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-10"
								/>
							</div>
						)}
					</div>

					{/* Supplier Cards */}
					<div className="space-y-4 mt-6">
						{sortedSupplierIds.map((supplierId) => {
							const supplier = allSuppliers.find((s) => s.id === supplierId);
							const entry = supplierEntries[supplierId];

							if (!supplier || !entry) return null;

							return (
								<div
									key={supplierId}
									className="p-5 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl space-y-4 shadow-sm"
								>
									{/* Supplier Header */}
									<div className="flex flex-col space-y-1 pb-3 border-b border-green-300">
										<div className="flex items-center justify-between">
											<h3 className="text-lg font-semibold text-gray-900">
												{supplier.name}
											</h3>
											{entry.id && (
												<span className="text-xs bg-green-200 px-2 py-1 rounded-full font-medium text-green-800">
													Configuré
												</span>
											)}
										</div>
										<p className="text-red-800 text-sm">
											Séparez les multiples possibilités par un "/". Ex :
											rétrocession sur souscription/parrainage/commission sur
											frais
										</p>
									</div>

									{/* Production Section */}
									<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
										<div className="space-y-3">
											<Badge variant="outline" className="text-sm">
												Production
											</Badge>
											<div className="grid grid-cols-10 gap-3">
												<div className="col-span-2">
													<Label className="text-xs text-gray-600 mb-1 block">
														Colonne "sous-code"{" "}
														<span className="text-red-600">*</span>
													</Label>
													<Input
														placeholder="Ex: A"
														value={entry.production?.subcode_column || ""}
														onChange={(e) =>
															updateField(
																supplierId,
																"production",
																"subcode_column",
																e.target.value,
															)
														}
														className="h-10"
													/>
												</div>
												<div className="col-span-6">
													<Label className="text-xs text-gray-600 mb-1 block">
														Mots clés à trouver dans la ligne
													</Label>
													<Input
														placeholder="Ex: production"
														value={entry.production?.verification_column || ""}
														onChange={(e) =>
															updateField(
																supplierId,
																"production",
																"verification_column",
																e.target.value,
															)
														}
														className="h-10"
													/>
												</div>
												<div className="col-span-2">
													<Label className="text-xs text-gray-600 mb-1 block">
														Colonne "montant"{" "}
														<span className="text-red-600">*</span>
													</Label>
													<Input
														placeholder="Ex: B"
														value={entry.production?.amount_column || ""}
														onChange={(e) =>
															updateField(
																supplierId,
																"production",
																"amount_column",
																e.target.value,
															)
														}
														className="h-10"
													/>
												</div>
											</div>
										</div>
									</div>

									{/* Encours Section */}
									<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
										<div className="space-y-3">
											<Badge variant="outline" className="text-sm">
												Encours
											</Badge>
											<div className="grid grid-cols-10 gap-3">
												<div className="col-span-2">
													<Label className="text-xs text-gray-600 mb-1 block">
														Colonne "sous-code"{" "}
														<span className="text-red-600">*</span>
													</Label>
													<Input
														placeholder="Ex: C"
														value={entry.encours?.subcode_column || ""}
														onChange={(e) =>
															updateField(
																supplierId,
																"encours",
																"subcode_column",
																e.target.value,
															)
														}
														className="h-10"
													/>
												</div>
												<div className="col-span-6">
													<Label className="text-xs text-gray-600 mb-1 block">
														Mots clés à trouver dans la ligne
													</Label>
													<Input
														placeholder="Ex: encours"
														value={entry.encours?.verification_column || ""}
														onChange={(e) =>
															updateField(
																supplierId,
																"encours",
																"verification_column",
																e.target.value,
															)
														}
														className="h-10"
													/>
												</div>
												<div className="col-span-2">
													<Label className="text-xs text-gray-600 mb-1 block">
														Colonne "montant"{" "}
														<span className="text-red-600">*</span>
													</Label>
													<Input
														placeholder="Ex: D"
														value={entry.encours?.amount_column || ""}
														onChange={(e) =>
															updateField(
																supplierId,
																"encours",
																"amount_column",
																e.target.value,
															)
														}
														className="h-10"
													/>
												</div>
											</div>
										</div>
									</div>

									{/* Production + Encours Section */}
									<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
										<div className="space-y-4">
											<Badge variant="outline" className="text-sm">
												Production + Encours
											</Badge>

											{/* Production Row */}
											<div className="space-y-2">
												<div className="flex items-center gap-2">
													<Badge variant="secondary" className="text-xs">
														Production
													</Badge>
												</div>
												<div className="grid grid-cols-10 gap-3">
													<div className="col-span-2">
														<Label className="text-xs text-gray-600 mb-1 block">
															Colonne "sous-code"{" "}
															<span className="text-red-600">*</span>
														</Label>
														<Input
															placeholder="Ex: F"
															value={
																entry.production_encours
																	?.production_subcode_column || ""
															}
															onChange={(e) =>
																updateField(
																	supplierId,
																	"production_encours",
																	"production_subcode_column",
																	e.target.value,
																)
															}
															className="h-10"
														/>
													</div>
													<div className="col-span-6">
														<Label className="text-xs text-gray-600 mb-1 block">
															Mots clés à trouver dans la ligne{" "}
															<span className="text-red-600">*</span>
														</Label>
														<Input
															placeholder="Ex: 'SCPI - rétrocession sur souscription classique'"
															value={
																entry.production_encours
																	?.production_verification_column || ""
															}
															onChange={(e) =>
																updateField(
																	supplierId,
																	"production_encours",
																	"production_verification_column",
																	e.target.value,
																)
															}
															className="h-10"
														/>
													</div>

													<div className="col-span-2">
														<Label className="text-xs text-gray-600 mb-1 block">
															Colonne "montant"{" "}
															<span className="text-red-600">*</span>
														</Label>
														<Input
															placeholder="Ex: G"
															value={
																entry.production_encours
																	?.production_amount_column || ""
															}
															onChange={(e) =>
																updateField(
																	supplierId,
																	"production_encours",
																	"production_amount_column",
																	e.target.value,
																)
															}
															className="h-10"
														/>
													</div>
												</div>
											</div>

											{/* Encours Row */}
											<div className="space-y-2">
												<div className="flex items-center gap-2">
													<Badge variant="secondary" className="text-xs">
														Encours
													</Badge>
												</div>
												<div className="grid grid-cols-10 gap-3">
													<div className="col-span-2">
														<Label className="text-xs text-gray-600 mb-1 block">
															Colonne "sous-code"{" "}
															<span className="text-red-600">*</span>
														</Label>
														<Input
															placeholder="Ex: I"
															value={
																entry.production_encours
																	?.encours_subcode_column || ""
															}
															onChange={(e) =>
																updateField(
																	supplierId,
																	"production_encours",
																	"encours_subcode_column",
																	e.target.value,
																)
															}
															className="h-10"
														/>
													</div>
													<div className="col-span-6">
														<Label className="text-xs text-gray-600 mb-1 block">
															Mots clés à trouver dans la ligne{" "}
															<span className="text-red-600">*</span>
														</Label>
														<Input
															placeholder="Ex: 'SCPI - Parrainage'"
															value={
																entry.production_encours
																	?.encours_verification_column || ""
															}
															onChange={(e) =>
																updateField(
																	supplierId,
																	"production_encours",
																	"encours_verification_column",
																	e.target.value,
																)
															}
															className="h-10"
														/>
													</div>

													<div className="col-span-2">
														<Label className="text-xs text-gray-600 mb-1 block">
															Colonne "montant"{" "}
															<span className="text-red-600">*</span>
														</Label>
														<Input
															placeholder="Ex: J"
															value={
																entry.production_encours
																	?.encours_amount_column || ""
															}
															onChange={(e) =>
																updateField(
																	supplierId,
																	"production_encours",
																	"encours_amount_column",
																	e.target.value,
																)
															}
															className="h-10"
														/>
													</div>
												</div>
											</div>
										</div>
									</div>

									{/* Actions */}
									<div className="flex items-center gap-2 pt-2">
										<Button
											variant="outline"
											size="sm"
											className="flex-1 h-10"
											onClick={() => {
												if (entry.id) {
													deleteMutation.mutate({ data: entry.id });
													return;
												}

												removeSupplier(supplierId);
											}}
											disabled={
												createMutation.isPending ||
												updateMutation.isPending ||
												deleteMutation.isPending
											}
										>
											<Trash2 className="h-4 w-4 mr-2" />
											{entry.id ? "Supprimer" : "Annuler"}
										</Button>
										<Button
											className="flex-1 h-10"
											onClick={() => saveSupplierMapping(supplierId)}
											disabled={
												createMutation.isPending ||
												updateMutation.isPending ||
												deleteMutation.isPending
											}
											size="sm"
										>
											<SaveIcon className="h-4 w-4 mr-2" />
											Sauvegarder
										</Button>
									</div>
								</div>
							);
						})}
					</div>

					{/* Empty State */}
					{sortedSupplierIds.length === 0 && (
						<div className="text-center py-8">
							<p className="text-gray-500 text-sm">
								Aucun fournisseur sélectionné. Cliquez sur "Sélectionner un
								fournisseur" pour commencer.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
