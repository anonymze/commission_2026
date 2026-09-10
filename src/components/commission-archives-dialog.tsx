import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	commissionArchivesQueryOptions,
	restoreCommissionQuery,
} from "@/api/queries/commission-archive-queries";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export function CommissionArchivesDialog({
	onClose,
	onExport,
	exportingId,
}: {
	onClose: () => void;
	onExport: (id: string) => void;
	exportingId?: string;
}) {
	const client = useQueryClient();
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState({ page: 1, search: "", month: "" });
	const [confirmation, setConfirmation] = useState<{
		id: string;
		name: string;
	} | null>(null);
	useEffect(() => {
		const timer = setTimeout(
			() =>
				setFilters((previous) =>
					previous.search === search.trim()
						? previous
						: { ...previous, page: 1, search: search.trim() },
				),
			300,
		);
		return () => clearTimeout(timer);
	}, [search]);
	const archives = useQuery(commissionArchivesQueryOptions(filters));
	const totalPages = Math.max(1, archives.data?.totalPages ?? 1);
	useEffect(() => {
		if (archives.data && filters.page > totalPages)
			setFilters((previous) => ({ ...previous, page: totalPages }));
	}, [archives.data, filters.page, totalPages]);
	const restore = useMutation({
		mutationFn: restoreCommissionQuery,
		onSuccess: async () => {
			setConfirmation(null);
			toast.success("Commission restaurée dans le tableau principal");
			await client.invalidateQueries({ queryKey: ["commissions"] });
		},
		onError: async () => {
			toast.error("Restauration non confirmée. La liste va être actualisée.");
			setConfirmation(null);
			await client.invalidateQueries({ queryKey: ["commissions"] });
		},
	});
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="max-w-[calc(100vw_-_2rem)] sm:max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden p-4 sm:p-6">
				<DialogHeader>
					<DialogTitle>Archives des commissions</DialogTitle>
					<DialogDescription>
						Recherchez une commission archivée, exportez-la ou restaurez-la dans
						le tableau principal.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3 sm:grid-cols-[1fr_190px_auto] items-end">
					<label className="grid gap-1.5 text-sm" htmlFor="archive-search">
						Collaborateur
						<Input
							id="archive-search"
							placeholder="Nom ou prénom"
							maxLength={120}
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</label>
					<label className="grid gap-1.5 text-sm" htmlFor="archive-month">
						Mois de commission
						<Input
							id="archive-month"
							type="month"
							min="1000-01"
							max="9999-12"
							value={filters.month}
							onChange={(event) =>
								setFilters((previous) => ({
									...previous,
									page: 1,
									month: event.target.value,
								}))
							}
						/>
					</label>
					<Button
						variant="ghost"
						size="sm"
						disabled={!search && !filters.month}
						onClick={() => {
							setSearch("");
							setFilters({ page: 1, search: "", month: "" });
						}}
					>
						Réinitialiser
					</Button>
				</div>
				<div
					className="min-h-0 overflow-auto rounded-md border"
					aria-busy={archives.isFetching}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Collaborateur</TableHead>
								<TableHead>Mois</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{archives.isPending ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-32 text-center"
										role="status"
									>
										Chargement des archives...
									</TableCell>
								</TableRow>
							) : archives.isError ? (
								<TableRow>
									<TableCell colSpan={3} className="h-32 text-center">
										<p role="alert">Impossible de charger les archives.</p>
										<Button
											variant="outline"
											size="sm"
											className="mt-3"
											onClick={() => archives.refetch()}
										>
											Réessayer
										</Button>
									</TableCell>
								</TableRow>
							) : !archives.data.docs.length ? (
								<TableRow>
									<TableCell
										colSpan={3}
										className="h-32 text-center text-muted-foreground"
									>
										Aucune commission archivée pour ces critères.
									</TableCell>
								</TableRow>
							) : (
								archives.data.docs.map((doc) => (
									<TableRow key={doc.id}>
										<TableCell className="font-medium whitespace-normal">
											{doc.name}
										</TableCell>
										<TableCell className="whitespace-normal sm:whitespace-nowrap">
											{new Date(doc.date).toLocaleDateString("fr-FR", {
												month: "long",
												year: "numeric",
												timeZone: "UTC",
											})}
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-2">
												<Button
													variant="outline"
													size="sm"
													aria-label={`Exporter la commission de ${doc.name}`}
													className="px-2 sm:px-3"
													disabled={!!exportingId}
													onClick={() => onExport(doc.id)}
												>
													<DownloadIcon className="size-4" />
													<span className="hidden sm:inline">
														{exportingId === doc.id ? "Export..." : "Exporter"}
													</span>
												</Button>
												<Button
													variant="outline"
													size="sm"
													aria-label={`Restaurer la commission de ${doc.name}`}
													className="px-2 sm:px-3"
													disabled={restore.isPending}
													onClick={() =>
														setConfirmation({ id: doc.id, name: doc.name })
													}
												>
													<RotateCcwIcon className="size-4" />
													<span className="hidden sm:inline">Restaurer</span>
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
				{confirmation && (
					<div
						className="rounded-md border bg-muted/40 p-3 space-y-2"
						role="alert"
					>
						<p className="text-sm">
							Restaurer la commission de <strong>{confirmation.name}</strong> ?
							Elle redeviendra visible dans le tableau principal.
						</p>
						<div className="flex gap-2">
							<Button
								size="sm"
								disabled={restore.isPending}
								onClick={() =>
									restore.mutate({ data: { id: confirmation.id } })
								}
							>
								{restore.isPending
									? "Restauration..."
									: "Confirmer la restauration"}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={restore.isPending}
								onClick={() => setConfirmation(null)}
							>
								Annuler
							</Button>
						</div>
					</div>
				)}
				<div className="flex flex-wrap justify-between items-center gap-3 text-sm">
					<p className="text-muted-foreground" aria-live="polite">
						{archives.data
							? `${archives.data.totalDocs} commission(s) archivée(s)`
							: ""}
					</p>
					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							size="sm"
							disabled={
								filters.page <= 1 || archives.isFetching || archives.isError
							}
							onClick={() =>
								setFilters((previous) => ({
									...previous,
									page: previous.page - 1,
								}))
							}
						>
							Précédent
						</Button>
						<span>
							Page {filters.page} / {totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={
								filters.page >= totalPages ||
								archives.isFetching ||
								archives.isError
							}
							onClick={() =>
								setFilters((previous) => ({
									...previous,
									page: previous.page + 1,
								}))
							}
						>
							Suivant
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
