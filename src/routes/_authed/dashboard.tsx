import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BookAlertIcon,
	CalculatorIcon,
	DownloadIcon,
	MailIcon,
	MoreHorizontalIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import z from "zod";
import { appUsersQueryOptions } from "@/api/queries/app-user-queries";
import {
	commissionsQueryOptions,
	deleteCommissionQuery,
	getCommissionExportQuery,
} from "@/api/queries/commission-queries";
import CreateCommissionDialog from "@/components/commission-dialog";
import { SearchInput } from "@/components/search-input";
import { TabSkeleton } from "@/components/tab-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {

	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { debounce } from "@/lib/utils";

const commissionSearchSchema = z.object({
	page: z.number().catch(1).default(1),
	filter: z.string().catch("").default(""),
	sort: z.enum(["newest", "oldest", "price"]).catch("newest").default("newest"),
});

// type CommissionSearch = z.infer<typeof commissionSearchSchema>;

export const Route = createFileRoute("/_authed/dashboard")({
	component: RouteComponent,
	validateSearch: commissionSearchSchema,
	loader: async ({ context }) => {
		try {
			await Promise.all([
				context.queryClient.ensureQueryData(commissionsQueryOptions()),
				context.queryClient.ensureQueryData(appUsersQueryOptions()),
			]);
		} catch (error) {
			console.error("Dashboard loader error:", error);
			// Let error boundary handle it instead of crashing stream
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
				<p>Impossible de charger les données. Le serveur est-il démarré ?</p>
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
	const { data, isFetching } = useSuspenseQuery(commissionsQueryOptions());
	const { data: usersData } = useSuspenseQuery(appUsersQueryOptions());
	const navigate = Route.useNavigate();
	const search = Route.useSearch();

	const [localFilter, setLocalFilter] = React.useState(search.filter);
	const [showCreateDialog, setShowCreateDialog] = React.useState(false);

	// Sync local filter with URL changes (e.g., back/forward navigation)
	React.useEffect(() => {
		setLocalFilter(search.filter);
	}, [search.filter]);

	// Handle page navigation
	const handlePageChange = (newPage: number) => {
		navigate({
			search: (prev) => ({ ...prev, page: newPage }),
		});
	};

	// Debounced navigate function
	const debouncedNavigate = React.useMemo(
		() =>
			debounce((value: string) => {
				navigate({ search: { filter: value } });
			}, 300),
		[navigate],
	);

	// Handle search change with debouncing
	const handleSearchChange = (value: string) => {
		setLocalFilter(value); // Update UI immediately
		debouncedNavigate(value); // Navigate after 300ms delay
	};

	// Delete commission mutation
	const deleteCommissionMutation = useMutation({
		mutationFn: deleteCommissionQuery,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["commissions"] });
			toast.success("Commission supprimée avec succès");
		},
		onError: () => {
			toast.error("Erreur lors de la suppression de la commission");
		},
	});

	// Export commission mutation
	const exportCommissionMutation = useMutation({
		mutationFn: getCommissionExportQuery,
		onSuccess: (response, variables) => {
			if ("email" in response && response.email) {
				toast.success("Commission envoyée par email avec succès");
				return;
			}

			if (!("base64" in response)) return;

			const { base64, contentType } = response;

			// Convert base64 to Blob
			const byteCharacters = atob(base64);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], { type: contentType });

			// Determine file extension
			let extension = ".xlsx";
			if (contentType.includes("text/csv")) {
				extension = ".csv";
			} else if (contentType.includes("application/vnd.ms-excel")) {
				extension = ".xls";
			}

			// Download file
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `commission-${variables.data.commissionId}${extension}`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			toast.success("Commission exportée avec succès");
		},
		onError: () => {
			toast.error("Erreur lors de l'exportation de la commission");
		},
	});

	// Filter data based on local filter (immediate UI update)
	const filteredData = {
		...data,
		docs: data.docs.filter((commission) => {
			const searchLower = localFilter.toLowerCase();
			const email = commission.app_user?.email?.toLowerCase() || "";
			const firstName = commission.app_user?.firstname?.toLowerCase() || "";
			const lastName = commission.app_user?.lastname?.toLowerCase() || "";

			return (
				email.includes(searchLower) ||
				firstName.includes(searchLower) ||
				lastName.includes(searchLower) ||
				`${firstName} ${lastName}`.includes(searchLower) ||
				`${lastName} ${firstName}`.includes(searchLower)
			);
		}),
	};

	return (
		<div>
			<Card>
				<CardHeader className="gap-0">
					<div className="flex items-center justify-between gap-2">
						<div className="flex flex-col gap-2">
							<CardTitle className="flex items-center gap-2">
								<CalculatorIcon className="w-5 h-5" />
								Gestion et calcul des Commissions
							</CardTitle>
							<CardDescription>
								Consultez, gérez et créez les commissions pour tous les
								employés.
							</CardDescription>
						</div>
						<Button
							disabled={
								deleteCommissionMutation.isPending ||
								exportCommissionMutation.isPending
							}
							onClick={() => setShowCreateDialog(true)}
						>
							Créer une commission
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert className="items-center">
						<BookAlertIcon className="h-4 w-4" />
						<AlertDescription>
							Les calculs de commissions sont basés sur les données importées et
							les mappings configurés. Assurez-vous que tous les fichiers sont
							traités et que les mappings sont corrects avant créer une
							commission.
						</AlertDescription>
					</Alert>

					{/* Filters */}
					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
						<SearchInput
							searchTerm={localFilter}
							onSearchChange={handleSearchChange}
						/>
						{/*<div className="flex items-center gap-2">
              <FilterIcon className="w-4 h-4 text-muted-foreground" />
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrer par période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les Périodes</SelectItem>
                  <SelectItem value="2024-01">Janvier 2024</SelectItem>
                  <SelectItem value="2024-02">Février 2024</SelectItem>
                  <SelectItem value="2024-03">Mars 2024</SelectItem>
                </SelectContent>
              </Select>
            </div>*/}
					</div>

					{/* Table or No Results */}
					{filteredData.docs.length === 0 && localFilter ? (
						<div className="p-6 flex items-center justify-center">
							<p className="text-gray-600">
								Aucun résultat trouvé pour "{localFilter}"
							</p>
						</div>
					) : (
						<div className="border rounded-lg">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="px-5">Email</TableHead>
										<TableHead className="px-5">Nom et prénom</TableHead>
										<TableHead className="px-5">Production</TableHead>
										<TableHead className="px-5">En cours</TableHead>
										<TableHead className="px-5">Date</TableHead>
										<TableHead className="ml-auto text-right px-5">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredData.docs.map((commission) => (
										<TableRow key={commission.id}>
											<TableCell className="font-medium px-5">
												{commission.app_user.email}
											</TableCell>
											<TableCell className="px-5">
												{commission.app_user.lastname}{" "}
												{commission.app_user.firstname}
											</TableCell>
											<TableCell className="px-5 font-semibold text-red-600">
												{commission.commission_suppliers
													.reduce((cum, item) => cum + (item.production || 0), 0)
													.toFixed(2)}
												€
											</TableCell>
											<TableCell className="px-5 font-semibold text-blue-600">
												{commission.commission_suppliers
													.reduce((cum, item) => cum + (item.encours || 0), 0)
													.toFixed(2)}
												€
											</TableCell>
											<TableCell className="px-5">
												{new Date(commission.date).toLocaleDateString("fr-FR", {
													day: "2-digit",
													month: "2-digit",
													year: "numeric",
												})}
											</TableCell>

											<TableCell className="text-right px-5">
												<DropdownMenu>
													<DropdownMenuTrigger
														disabled={
															deleteCommissionMutation.isPending ||
															exportCommissionMutation.isPending
														}
														asChild
													>
														<Button variant="ghost" className="h-8 w-8 p-0">
															<span className="sr-only">Ouvrir le menu</span>
															<MoreHorizontalIcon className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={() =>
																deleteCommissionMutation.mutate({
																	data: commission.id,
																})
															}
														>
															<Trash2Icon className="mr-2 h-4 w-4" />
															<span>Supprimer</span>
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem
															onClick={() =>
																exportCommissionMutation.mutate({
																	data: {
																		commissionId: commission.id,
																	},
																})
															}
														>
															<DownloadIcon className="mr-2 h-4 w-4" />
															<span>Exporter</span>
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																exportCommissionMutation.mutate({
																	data: {
																		commissionId: commission.id,
																		email: commission.app_user.email,
																	},
																})
															}
														>
															<MailIcon className="mr-2 h-4 w-4" />
															<span>Envoyer</span>
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}

					{/* Pagination */}
					{data.totalPages > 1 && (
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								Affichage de {(data.page - 1) * data.limit + 1} à{" "}
								{Math.min(data.page * data.limit, data.totalDocs)} sur{" "}
								{data.totalDocs} commissions
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => handlePageChange(search.page - 1)}
									disabled={!data.hasPrevPage || isFetching}
								>
									Précédent
								</Button>
								<span className="flex items-center px-3 text-sm">
									Page {data.page} sur {data.totalPages}
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() => handlePageChange(search.page + 1)}
									disabled={!data.hasNextPage || isFetching}
								>
									Suivant
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
			<CreateCommissionDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				users={usersData}
			/>
		</div>
	);
}
