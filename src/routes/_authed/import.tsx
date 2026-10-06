import {
	queryOptions,
	useMutation,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BookAlertIcon,
	Check,
	ChevronsUpDown,
	FileIcon,
	Loader2,
	Trash2,
	Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	createCommissionImportQuery,
	deleteCommissionImportQuery,
	getCommissionsImportQuery,
} from "@/api/queries/commission-queries";
import { suppliersQueryOptions } from "@/api/queries/supplier-queries";
import { SearchInput } from "@/components/search-input";
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
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { CommissionImport } from "@/types/commission";

const allowedTypes = [
	"text/csv",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.oasis.opendocument.spreadsheet",
];
const allowedExtensions = [".csv", ".xls", ".xlsx", ".ods"];
const PDF_MODE = "pdf-unassigned";

type EntryType = CommissionImport["entry"];

// Query options for SSR
const commissionsImportQueryOptions = () =>
	queryOptions({
		queryKey: ["commissions-import", { limit: 100 }],
		queryFn: () =>
			getCommissionsImportQuery({ data: { limit: 100, pagination: false } }),
	});

export const Route = createFileRoute("/_authed/import")({
	component: RouteComponent,
	loader: async ({ context }) => {
		try {
			await Promise.all([
				context.queryClient.ensureQueryData(commissionsImportQueryOptions()),
				context.queryClient.ensureQueryData(suppliersQueryOptions()),
			]);
		} catch (error) {
			console.error("Import loader error:", error);
			throw error;
		}
	},
	pendingComponent: () => <TabSkeleton />,
	errorComponent: ({ error }) => (
		<Card className="m-4">
			<CardHeader>
				<CardTitle>Erreur de chargement</CardTitle>
			</CardHeader>
			<CardContent>
				<p>Impossible de charger les données d'importation.</p>
				<p className="text-sm text-gray-500 mt-2">{String(error)}</p>
				<Button className="mt-4" onClick={() => window.location.reload()}>
					Réessayer
				</Button>
			</CardContent>
		</Card>
	),
});

function RouteComponent() {
	const { queryClient } = Route.useRouteContext();

	const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
	const [selectedEntry, setSelectedEntry] = useState<EntryType | null>(null);
	const [supplierOpen, setSupplierOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isDragging, setIsDragging] = useState(false);
	const isPdfMode = selectedSupplier === PDF_MODE;

	const { data: commissionImports } = useSuspenseQuery(
		commissionsImportQueryOptions(),
	);

	const { data: suppliers } = useSuspenseQuery(suppliersQueryOptions());

	// Mutations
	const createImportMutation = useMutation({
		mutationFn: createCommissionImportQuery,
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["commissions-import"] });
			toast.success(`${result.uploaded} fichier(s) importé(s)`);
			if (result.failed > 0) {
				toast.error(
					`Fichiers non importés : ${result.failedFiles?.join(", ")}`,
				);
			}
		},
		onError: () => {
			toast.error("Erreur lors de l'importation du fichier");
		},
	});

	const deleteImportMutation = useMutation({
		mutationFn: deleteCommissionImportQuery,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["commissions-import"] });
			toast.success("Import supprimé avec succès");
		},
		onError: () => {
			toast.error("Erreur lors de la suppression de l'import");
		},
	});

	const allSuppliers = suppliers?.docs || [];
	const existingImports = commissionImports?.docs || [];

	// Calculate total files count
	const totalFilesCount = useMemo(() => {
		return existingImports.reduce(
			(sum, imp) => sum + (imp.files?.length || 0),
			0,
		);
	}, [existingImports]);

	const validateFile = (file: File): string | null => {
		const isPdf =
			file.type === "application/pdf" ||
			file.name.toLowerCase().endsWith(".pdf");
		if (isPdfMode) return isPdf ? null : "Ce mode accepte uniquement des PDF";
		if (isPdf) return "Choisissez Importer des PDF dans le sélecteur";
		const hasValidType = allowedTypes.includes(file.type);
		const hasValidExtension = allowedExtensions.some((ext) =>
			file.name.toLowerCase().endsWith(ext),
		);

		if (!hasValidType && !hasValidExtension) {
			return "Le fichier doit être au format CSV, XLS, XLSX ou ODS";
		}

		return null;
	};

	const handleFileUpload = (files: FileList | null) => {
		if (createImportMutation.isPending || deleteImportMutation.isPending)
			return;
		if (!selectedSupplier || !selectedEntry || !files || files.length === 0) {
			toast.error("Veuillez sélectionner un fournisseur et un type d'entrée");
			return;
		}

		// Convert FileList to array
		const fileArray = Array.from(files);

		// Validate all files first
		for (const file of fileArray) {
			const error = validateFile(file);
			if (error) {
				toast.error(`${file.name}: ${error}`);
				return;
			}
		}

		// Create single FormData with all files
		const formData = new FormData();
		if (isPdfMode) formData.append("mode", "pdf");
		else formData.append("supplier", selectedSupplier);
		formData.append("entry", selectedEntry);

		// Append all files using "files" field name
		for (const file of fileArray) {
			formData.append("files", file);
		}

		console.log("Uploading batch:", {
			supplier: selectedSupplier,
			entry: selectedEntry,
			fileCount: fileArray.length,
			filenames: fileArray.map((f) => f.name),
		});

		// Single mutation call for all files
		createImportMutation.mutate({ data: formData });
	};

	const handleSelectSupplier = (supplierId: string) => {
		setSelectedSupplier(supplierId);
		setSelectedEntry(null);
		setSupplierOpen(false);
	};

	const handleDeleteImport = (importId: string) => {
		deleteImportMutation.mutate({ data: importId });
	};

	// Group imports by supplier with search filter
	const importsBySupplier = useMemo(() => {
		const grouped: Record<string, CommissionImport[]> = {};
		existingImports.forEach((imp) => {
			const supplierId =
				(typeof imp.supplier === "string" ? imp.supplier : imp.supplier?.id) ||
				PDF_MODE;
			if (!grouped[supplierId]) {
				grouped[supplierId] = [];
			}
			grouped[supplierId].push(imp);
		});

		// Filter by search query
		if (!searchQuery.trim()) return grouped;

		const lowerQuery = searchQuery.toLowerCase();
		const filtered: Record<string, CommissionImport[]> = {};

		Object.entries(grouped).forEach(([supplierId, imports]) => {
			const supplier = allSuppliers.find((s) => s.id === supplierId);
			const label =
				supplierId === PDF_MODE
					? "PDF - Fournisseur à identifier"
					: supplier?.name;
			if (label?.toLowerCase().includes(lowerQuery)) {
				filtered[supplierId] = imports;
			}
		});

		return filtered;
	}, [existingImports, searchQuery, allSuppliers]);

	const selectedSupplierData = allSuppliers.find(
		(s) => s.id === selectedSupplier,
	);

	const isUploading = createImportMutation.isPending;
	const isDeleting = deleteImportMutation.isPending;
	const isOperating = isUploading || isDeleting;

	return (
		<Card>
			<CardHeader className="gap-0">
				<div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
					<div className="flex flex-col gap-2">
						<CardTitle className="flex items-center gap-2">
							<FileIcon className="w-5 h-5" />
							Importation des fichiers de commissions
						</CardTitle>
						<CardDescription>
							Choisissez un fournisseur pour Excel, ou importez vos PDF
							ensemble.
						</CardDescription>
					</div>
					{isOperating && (
						<Loader2 className="h-5 w-5 animate-spin text-black" />
					)}
					<Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="default"
								role="combobox"
								aria-expanded={supplierOpen}
								className="w-full justify-between sm:w-auto sm:min-w-[220px]"
								disabled={isOperating}
							>
								{isPdfMode
									? "Importer des PDF"
									: selectedSupplierData?.name || "Choisir un import"}
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Fournisseur ou PDF..." />
								<CommandList>
									<CommandEmpty>Aucun fournisseur trouvé.</CommandEmpty>
									<CommandGroup className="max-h-[230px] overflow-auto">
										<CommandItem
											value="Importer des PDF sans fournisseur"
											onSelect={() => handleSelectSupplier(PDF_MODE)}
										>
											<FileIcon className="mr-2 h-4 w-4" />
											Importer des PDF
										</CommandItem>
										{allSuppliers.map((supplier) => (
											<CommandItem
												key={supplier.id}
												value={supplier.name}
												onSelect={() => handleSelectSupplier(supplier.id)}
											>
												<Check
													className={`mr-2 h-4 w-4 ${selectedSupplier === supplier.id ? "opacity-100" : "opacity-0"}`}
												/>
												{supplier.name}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<Alert className="items-center">
					<BookAlertIcon className="h-4 w-4" />
					<AlertDescription>
						Les PDF peuvent provenir de fournisseurs différents. Ils sont
						conservés sans fournisseur, en attente d'extraction, hors calcul des
						commissions. Les fichiers Excel s'ajoutent aux imports du
						fournisseur choisi.
					</AlertDescription>
				</Alert>

				<SearchInput searchTerm={searchQuery} onSearchChange={setSearchQuery} />

				{/* Step 2: Entry Type Selection */}
				{selectedSupplier && (
					<div className="space-y-2.5">
						<Label>2. Choisir le type d'entrée</Label>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<Button
								variant={selectedEntry === "production" ? "default" : "outline"}
								onClick={() => setSelectedEntry("production")}
								disabled={isOperating}
								className="h-auto py-3 flex flex-col items-center gap-1"
							>
								<span className="font-medium">Production</span>
							</Button>
							<Button
								variant={selectedEntry === "encours" ? "default" : "outline"}
								onClick={() => setSelectedEntry("encours")}
								disabled={isOperating}
								className="h-auto py-3 flex flex-col items-center gap-1"
							>
								<span className="font-medium">Encours</span>
							</Button>
							<Button
								variant={
									selectedEntry === "production_encours" ? "default" : "outline"
								}
								onClick={() => setSelectedEntry("production_encours")}
								disabled={isOperating}
								className="h-auto py-3 flex flex-col items-center gap-1"
							>
								<span className="font-medium">Production + Encours</span>
							</Button>
						</div>
					</div>
				)}

				{/* Step 3: File Upload */}
				{selectedSupplier && selectedEntry && (
					<div className="space-y-2.5">
						<Label>3. Importer le(s) fichier(s)</Label>
						<fieldset
							aria-label="Importer des fichiers"
							onDragOver={(event) => {
								event.preventDefault();
								if (!isOperating) setIsDragging(true);
							}}
							onDragLeave={(event) => {
								if (
									!event.currentTarget.contains(
										event.relatedTarget as Node | null,
									)
								) {
									setIsDragging(false);
								}
							}}
							onDrop={(event) => {
								event.preventDefault();
								setIsDragging(false);
								handleFileUpload(event.dataTransfer.files);
							}}
							className={`relative min-w-0 border-2 border-dashed rounded-lg p-6 text-center focus-within:ring-2 focus-within:ring-ring ${isDragging ? "border-primary bg-accent" : "border-border"} ${isOperating ? "opacity-50" : ""}`}
						>
							<input
								type="file"
								accept={
									isPdfMode
										? ".pdf,application/pdf"
										: allowedExtensions.join(",")
								}
								multiple
								onChange={(e) => {
									handleFileUpload(e.target.files);
									e.target.value = ""; // Reset input to allow re-upload
								}}
								className="sr-only"
								id="file-upload"
								disabled={isOperating}
							/>
							<label
								htmlFor="file-upload"
								className="cursor-pointer flex flex-col items-center gap-2"
							>
								{isUploading ? (
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								) : (
									<Upload className="h-8 w-8 text-muted-foreground" />
								)}
								<span className="text-sm text-muted-foreground">
									{isUploading
										? "Import en cours..."
										: "Déposer vos fichiers ici ou cliquer pour les sélectionner"}
								</span>
								<span className="text-xs text-muted-foreground">
									{isPdfMode ? "PDF uniquement" : "CSV, XLS, XLSX ou ODS"} ·
									Plusieurs fichiers possibles
								</span>
								<Badge variant="outline">
									{isPdfMode
										? "PDF sans fournisseur"
										: selectedSupplierData?.name}{" "}
									-{" "}
									{selectedEntry === "production_encours"
										? "Production + Encours"
										: selectedEntry.charAt(0).toUpperCase() +
											selectedEntry.slice(1)}
								</Badge>
							</label>
						</fieldset>
					</div>
				)}

				{/* Existing Imports */}
				{existingImports.length > 0 && (
					<div className="space-y-2.5">
						<Label>Fichiers importés ({totalFilesCount})</Label>
						<div className="space-y-4">
							{Object.entries(importsBySupplier).map(
								([supplierId, imports]) => {
									const supplier = allSuppliers.find(
										(s) => s.id === supplierId,
									);
									const supplierName =
										supplierId === PDF_MODE
											? "PDF - Fournisseur à identifier"
											: supplier?.name || "Fournisseur indisponible";

									// Calculate total files for this supplier
									const totalFiles = imports.reduce(
										(sum, imp) => sum + (imp.files?.length || 0),
										0,
									);

									return (
										<div
											key={supplierId}
											className="p-4 bg-accent/40 border border-border rounded-lg space-y-3"
										>
											{/* Supplier Header */}
											<div className="flex items-center justify-between">
												<span className="text-sm font-semibold">
													{supplierName}
												</span>
												<Badge variant="secondary">
													{totalFiles} fichier(s)
												</Badge>
											</div>

											{/* Imports for this supplier */}
											<div className="space-y-2">
												{imports.map((importItem) => (
													<div
														key={importItem.id}
														className="p-3 bg-card rounded border border-border space-y-2"
													>
														<div className="flex items-center justify-between">
															<Badge variant="outline">
																{importItem.entry === "production_encours"
																	? "Production + Encours"
																	: importItem.entry.charAt(0).toUpperCase() +
																		importItem.entry.slice(1)}
															</Badge>
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	handleDeleteImport(importItem.id)
																}
																className="h-7 w-7 p-0 hover:bg-red-50"
																disabled={isOperating}
															>
																<Trash2 className="h-4 w-4 text-red-500" />
															</Button>
														</div>
														{/* Display all files for this import */}
														<div className="space-y-1">
															{importItem.files?.map((fileItem, idx) => (
																<div
																	key={idx}
																	className="flex flex-wrap items-center gap-2 text-sm text-foreground"
																>
																	<Upload className="h-4 w-4 text-green-600" />
																	<span className="min-w-0 break-all">
																		{typeof fileItem.file === "string"
																			? fileItem.file
																			: fileItem.file?.filename ||
																				"Fichier inconnu"}
																	</span>
																	{typeof fileItem.file !== "string" &&
																		(fileItem.file?.mimeType ===
																			"application/pdf" ||
																			fileItem.file?.filename
																				?.toLowerCase()
																				.endsWith(".pdf")) && (
																			<Badge variant="secondary">
																				PDF · En attente d'extraction
																			</Badge>
																		)}
																</div>
															))}
														</div>
													</div>
												))}
											</div>
										</div>
									);
								},
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
