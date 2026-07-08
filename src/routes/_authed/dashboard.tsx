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
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { debounce } from "@/lib/utils";
import type { User } from "@/types/user";

// resolve app-user ids whose email / name matches the search term
function matchUserIds(users: User[], filter: string): string[] {
	const q = filter.trim().toLowerCase();
	return users
		.filter((u) => {
			const email = u.email?.toLowerCase() || "";
			const firstName = u.firstname?.toLowerCase() || "";
			const lastName = u.lastname?.toLowerCase() || "";
			return (
				email.includes(q) ||
				firstName.includes(q) ||
				lastName.includes(q) ||
				`${firstName} ${lastName}`.includes(q) ||
				`${lastName} ${firstName}`.includes(q)
			);
		})
		.map((u) => u.id);
}

// build page items with ellipsis for large page counts
function getPageItems(
	current: number,
	total: number,
): (number | "gap-left" | "gap-right")[] {
	if (total <= 7) {
		return Array.from({ length: total }, (_, i) => i + 1);
	}
	const items: (number | "gap-left" | "gap-right")[] = [1];
	const left = Math.max(2, current - 1);
	const right = Math.min(total - 1, current + 1);
	if (left > 2) items.push("gap-left");
	for (let i = left; i <= right; i++) items.push(i);
	if (right < total - 1) items.push("gap-right");
	items.push(total);
	return items;
}

const commissionSearchSchema = z.object({
	page: z.number().catch(1).default(1),
	filter: z.string().catch("").default(""),
	sort: z.enum(["newest", "oldest", "price"]).catch("newest").default("newest"),
});

// type CommissionSearch = z.infer<typeof commissionSearchSchema>;

export const Route = createFileRoute("/_authed/dashboard")({
	component: RouteComponent,
	validateSearch: commissionSearchSchema,
	loaderDeps: ({ search: { page, filter, sort } }) => ({ page, filter, sort }),
	loader: async ({ context, deps }) => {
		try {
			const users = await context.queryClient.ensureQueryData(
				appUsersQueryOptions(),
			);
			const userIds = deps.filter
				? matchUserIds(users.docs, deps.filter)
				: undefined;
			await context.queryClient.ensureQueryData(
				commissionsQueryOptions({
					page: deps.page,
					sort: deps.sort,
					userIds,
				}),
			);
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
	const { data: usersData } = useSuspenseQuery(appUsersQueryOptions());
	const navigate = Route.useNavigate();
	const search = Route.useSearch();

	// server-side pagination: resolve matching users, fetch that page (10/page)
	const userIds = search.filter
		? matchUserIds(usersData.docs, search.filter)
		: undefined;
	const { data } = useSuspenseQuery(
		commissionsQueryOptions({
			page: search.page,
			sort: search.sort,
			userIds,
		}),
	);

	const totalPages = data.totalPages;
	const currentPage = data.page;
	const totalCount = data.totalDocs;

	const [localFilter, setLocalFilter] = React.useState(search.filter);
	const [showCreateDialog, setShowCreateDialog] = React.useState(false);

	// Sync local filter with URL changes (e.g., back/forward navigation)
	React.useEffect(() => {
		setLocalFilter(search.filter);
	}, [search.filter]);

	// Handle page navigation (clamped to valid range)
	const handlePageChange = (newPage: number) => {
		const clamped = Math.min(Math.max(newPage, 1), totalPages);
		navigate({
			search: (prev) => ({ ...prev, page: clamped }),
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
		onError: (error) => {
			toast.error(
				error.message || "Erreur lors de l'exportation de la commission",
			);
		},
	});

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
					{data.docs.length === 0 && search.filter ? (
						<div className="p-6 flex items-center justify-center">
							<p className="text-gray-600">
								Aucun résultat trouvé pour "{search.filter}"
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
									{data.docs.map((commission) => (
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
													.reduce(
														(cum, item) => cum + (item.production || 0),
														0,
													)
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
					{totalPages > 1 && (
						<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
							<p className="text-sm text-muted-foreground">
								Affichage de {(currentPage - 1) * data.limit + 1} à{" "}
								{Math.min(currentPage * data.limit, totalCount)} sur{" "}
								{totalCount} commissions
							</p>
							<Pagination className="mx-0 w-auto justify-end">
								<PaginationContent>
									<PaginationItem>
										<PaginationPrevious
											href="#"
											aria-disabled={currentPage === 1}
											className={
												currentPage === 1
													? "pointer-events-none opacity-50"
													: undefined
											}
											onClick={(e) => {
												e.preventDefault();
												handlePageChange(currentPage - 1);
											}}
										/>
									</PaginationItem>
									{getPageItems(currentPage, totalPages).map((item) =>
										typeof item !== "number" ? (
											<PaginationItem key={item}>
												<PaginationEllipsis />
											</PaginationItem>
										) : (
											<PaginationItem key={item}>
												<PaginationLink
													href="#"
													isActive={item === currentPage}
													onClick={(e) => {
														e.preventDefault();
														handlePageChange(item);
													}}
												>
													{item}
												</PaginationLink>
											</PaginationItem>
										),
									)}
									<PaginationItem>
										<PaginationNext
											href="#"
											aria-disabled={currentPage === totalPages}
											className={
												currentPage === totalPages
													? "pointer-events-none opacity-50"
													: undefined
											}
											onClick={(e) => {
												e.preventDefault();
												handlePageChange(currentPage + 1);
											}}
										/>
									</PaginationItem>
								</PaginationContent>
							</Pagination>
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
