import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { cloneElement, type ReactElement, useId, useState } from "react";
import { toast } from "sonner";
import {
	analyzePdfReview,
	pdfReviewOptionsQueryOptions,
	pdfReviewQueryOptions,
	savePdfReview,
} from "@/api/queries/pdf-review-queries";
import { PdfEntitySelect } from "@/components/pdf-entity-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
	PdfDocument,
	PdfReview,
	PdfReviewInput,
	PdfReviewLine,
	PdfReviewOptions,
	PdfTarget,
} from "@/types/pdf-review";

const money = (amount: number) =>
	new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
		amount,
	);
const amountFormat = new Intl.NumberFormat("en-US", {
	useGrouping: false,
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
const roundAmount = (value: number | null) =>
	value === null ? null : Number(amountFormat.format(value)) || 0;

export function PdfReviewDialog({
	target,
	onClose,
}: {
	target: PdfTarget;
	onClose: () => void;
}) {
	const client = useQueryClient();
	const [dirty, setDirty] = useState(false);
	const query = useQuery({
		...pdfReviewQueryOptions(target),
		refetchOnWindowFocus: false,
		refetchInterval: (query) =>
			query.state.data?.review?.status === "processing" ? 3000 : false,
	});
	const options = useQuery(pdfReviewOptionsQueryOptions());
	const analyze = useMutation({
		mutationFn: () => analyzePdfReview({ data: target }),
		onSuccess: () => {
			void query.refetch();
			void client.invalidateQueries({ queryKey: ["commissions-import"] });
		},
		onError: (error) => toast.error(error.message),
	});
	const review = query.data?.review;
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (
					!open &&
					(!dirty ||
						window.confirm("Fermer sans enregistrer vos modifications ?"))
				)
					onClose();
			}}
		>
			<DialogContent className="[color-scheme:light] dark:[color-scheme:dark] flex max-h-[94dvh] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-4 sm:max-w-6xl sm:p-6">
				<DialogHeader>
					<DialogTitle>Vérifier le relevé PDF</DialogTitle>
					<DialogDescription className="break-all">
						{query.data?.filename || "Lecture du fichier"}
					</DialogDescription>
				</DialogHeader>
				{(query.isPending || options.isPending) && (
					<p className="flex items-center gap-2 py-8">
						<Loader2 className="h-4 w-4 animate-spin" />
						Chargement…
					</p>
				)}
				{(query.isError || options.isError) && (
					<Alert>
						<AlertDescription>
							Impossible de charger la vérification.
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									void query.refetch();
									void options.refetch();
								}}
							>
								Réessayer
							</Button>
						</AlertDescription>
					</Alert>
				)}
				{query.data && options.data && (
					<>
						{query.data.url && (
							<a
								href={query.data.url}
								target="_blank"
								rel="noreferrer"
								className="flex w-fit items-center gap-1 text-sm underline underline-offset-4"
							>
								Ouvrir le PDF original
								<ExternalLink className="h-3.5 w-3.5" />
							</a>
						)}
						{review?.document &&
						["draft", "validated"].includes(review.status) ? (
							<PdfReviewEditor
								key={review.revision}
								target={target}
								review={review}
								initialDocument={review.document}
								options={options.data}
								onDirty={setDirty}
								onSaved={() => {
									setDirty(false);
									void query.refetch();
									onClose();
								}}
							/>
						) : (
							<div className="space-y-4 py-6">
								<p>
									{analyze.isPending || review?.status === "processing"
										? "Lecture du PDF et recherche des correspondances en cours…"
										: review?.error ||
											"Le PDF est conservé. Lancez son analyse pour préparer les données à vérifier."}
								</p>
								<Button
									disabled={analyze.isPending}
									onClick={() => analyze.mutate()}
								>
									{analyze.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : null}
									{review?.status === "processing"
										? "Vérifier / reprendre l’analyse"
										: "Analyser le PDF"}
								</Button>
							</div>
						)}
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

function PdfReviewEditor({
	initialDocument,
	target,
	review,
	options,
	onDirty,
	onSaved,
}: {
	target: PdfTarget;
	review: PdfReview;
	initialDocument: PdfDocument;
	options: PdfReviewOptions;
	onDirty: (dirty: boolean) => void;
	onSaved: () => void;
}) {
	const client = useQueryClient();
	const [document, setDocument] = useState<PdfDocument>(() => ({
		...initialDocument,
		commission_total: roundAmount(initialDocument.commission_total),
	}));
	const [supplierId, setSupplierId] = useState(review.supplierId);
	const [lines, setLines] = useState(() =>
		review.lines.map((line) => ({
			...line,
			commission_amount: roundAmount(line.commission_amount),
		})),
	);
	const [error, setError] = useState("");
	const input = (action: PdfReviewInput["action"]): PdfReviewInput => ({
		revision: review.revision,
		action,
		supplierId,
		document,
		lines: lines.map(({ match: _match, ...line }) => line),
	});
	const save = useMutation({
		mutationFn: (action: PdfReviewInput["action"]) =>
			savePdfReview({ data: { ...target, input: input(action) } }),
		onSuccess: (result) => {
			void client.invalidateQueries({ queryKey: ["commissions-import"] });
			void client.invalidateQueries({ queryKey: ["commission-import-user"] });
			toast.success(
				result.review.status === "validated"
					? "Relevé enregistré et validé"
					: "Brouillon enregistré",
			);
			onSaved();
		},
		onError: (error) => setError(error.message),
	});
	const busy = save.isPending;
	const total =
		lines.reduce(
			(sum, line) => sum + Math.round((line.commission_amount ?? 0) * 100),
			0,
		) / 100;
	const incomplete = lines.filter(
		(line) => !line.appUserId || !line.entry || line.commission_amount === null,
	).length;
	const balanced =
		document.commission_total !== null &&
		Math.round(total * 100) === Math.round(document.commission_total * 100);
	const canValidate =
		!!supplierId &&
		lines.length > 0 &&
		!incomplete &&
		document.commission_total !== null;
	function editDocument(patch: Partial<PdfDocument>) {
		setDocument((previous) => ({ ...previous, ...patch }));
		onDirty(true);
		setError("");
	}
	function editLine(id: string, patch: Partial<PdfReviewLine>) {
		setLines((previous) =>
			previous.map((line) => (line.id === id ? { ...line, ...patch } : line)),
		);
		onDirty(true);
		setError("");
	}
	return (
		<>
			<div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
				<div className="flex flex-wrap items-center gap-2">
					<Badge
						variant={review.status === "validated" ? "default" : "secondary"}
					>
						{review.status === "validated" ? "Validé" : "À vérifier"}
					</Badge>
					<p className="text-sm text-muted-foreground">
						Vérifiez les données proposées avant de les enregistrer.
					</p>
				</div>
				<fieldset disabled={busy} className="min-w-0 space-y-4">
					<legend className="mb-3 text-sm font-semibold">
						Fournisseur et total
					</legend>
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="min-w-0 space-y-1.5">
							<p className="text-sm">
								Fournisseur <RequiredMark />
							</p>
							<PdfEntitySelect
								label="Fournisseur"
								required
								value={supplierId}
								options={options.suppliers}
								match={review.supplierMatch}
								onChange={(id) => {
									setSupplierId(id);
									setLines((previous) =>
										previous.map((line) => ({
											...line,
											appUserId: null,
											match: { kind: "unmatched", candidates: [] },
										})),
									);
									onDirty(true);
								}}
							/>
							<p className="text-xs text-muted-foreground">
								Lu dans le PDF :{" "}
								{review.extracted?.supplier_name || "Non identifié"}
							</p>
						</div>
						<Field label="Total commissions HT" required>
							<PdfAmountInput
								value={document.commission_total}
								onChange={(commission_total) =>
									editDocument({ commission_total })
								}
							/>
						</Field>
					</div>
				</fieldset>
				<div className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-sm font-semibold">
							Lignes de commissions ({lines.length})
						</h3>
						<span className="text-sm text-muted-foreground">
							{incomplete
								? `${incomplete} ligne(s) à compléter`
								: "Toutes les lignes sont renseignées"}
						</span>
					</div>
					{lines.map((line, index) => (
						<div key={line.id} className="relative">
							<fieldset
								disabled={busy}
								className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-4"
							>
								<legend className="px-1 text-sm font-medium">
									Ligne {index + 1}
								</legend>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Retirer la ligne ${index + 1}`}
									title="Retirer cette ligne"
									className="absolute right-2 top-4 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
									onClick={() => {
										setLines((previous) =>
											previous.filter((item) => item.id !== line.id),
										);
										onDirty(true);
									}}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
								<div className="grid gap-3 sm:grid-cols-2">
									<Field label="Client">
										<Input
											value={line.client_name}
											onChange={(event) =>
												editLine(line.id, { client_name: event.target.value })
											}
										/>
									</Field>
									<Field label="Commission HT (€)" required>
										<PdfAmountInput
											value={line.commission_amount}
											onChange={(commission_amount) =>
												editLine(line.id, { commission_amount })
											}
										/>
									</Field>
									<div className="min-w-0 space-y-1.5">
										<p className="text-sm">
											Indépendant <RequiredMark />
										</p>
										<PdfEntitySelect
											label={`Indépendant ligne ${index + 1}`}
											required
											value={line.appUserId}
											options={options.users}
											match={line.match}
											disabled={busy}
											onChange={(id) => editLine(line.id, { appUserId: id })}
										/>
										<p className="break-words text-xs text-muted-foreground">
											Lu : {line.advisor_name || "Absent du PDF"}
											{line.advisor_code ? ` · Code ${line.advisor_code}` : ""}
										</p>
									</div>
									<Field label="Type de commission" required>
										<select
											className="h-9 w-full rounded-md border bg-background px-3 text-sm"
											value={line.entry || ""}
											onChange={(event) =>
												editLine(line.id, {
													entry:
														event.target.value === "production" ||
														event.target.value === "encours"
															? event.target.value
															: null,
												})
											}
										>
											<option value="">Choisir…</option>
											<option value="production">Production</option>
											<option value="encours">Encours</option>
										</select>
									</Field>
								</div>
							</fieldset>
						</div>
					))}
					<Button
						variant="outline"
						size="sm"
						disabled={busy || lines.length >= 500}
						onClick={() => {
							setLines((previous) => [
								...previous,
								{
									id: crypto.randomUUID(),
									client_name: "",
									advisor_name: "",
									advisor_code: "",
									product: "",
									operation_date: "",
									commission_amount: null,
									page: 1,
									appUserId: null,
									entry: null,
									match: { kind: "unmatched", candidates: [] },
								},
							]);
							onDirty(true);
						}}
					>
						<Plus className="h-4 w-4" />
						Ajouter une ligne manquante
					</Button>
				</div>
			</div>
			<div className="space-y-3 border-t pt-3">
				<div className="flex flex-wrap justify-between gap-2 text-sm">
					<span>
						Somme des lignes : <strong>{money(total)}</strong>
					</span>
					<span className="text-muted-foreground">
						Total du relevé :{" "}
						<strong>
							{document.commission_total === null
								? "à renseigner"
								: money(document.commission_total)}
						</strong>
					</span>
				</div>
				{document.commission_total !== null && !balanced && (
					<p
						role="status"
						className="text-sm text-amber-700 dark:text-amber-400"
					>
						Écart de {money(total - document.commission_total)} par rapport au
						total du relevé. Vous pouvez enregistrer et valider.
					</p>
				)}
				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
				{!canValidate && (
					<p className="text-xs text-muted-foreground">
						La validation nécessite un fournisseur, un indépendant et un type
						par ligne, les montants des commissions et le total du relevé.
					</p>
				)}
				<div className="flex flex-wrap justify-end gap-2">
					<Button
						variant="outline"
						disabled={busy || !lines.length}
						onClick={() => {
							setError("");
							save.mutate("draft");
						}}
					>
						Enregistrer le brouillon
					</Button>
					<Button
						disabled={busy || !canValidate}
						onClick={() => {
							setError("");
							save.mutate("validate");
						}}
					>
						{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
						Enregistrer et valider
					</Button>
				</div>
			</div>
		</>
	);
}

function PdfAmountInput({
	value,
	onChange,
	...props
}: {
	id?: string;
	"aria-required"?: boolean;
	value: number | null;
	onChange: (value: number | null) => void;
}) {
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<Input
			{...props}
			type="number"
			step="0.01"
			value={draft ?? (value === null ? "" : amountFormat.format(value))}
			onFocus={(event) => setDraft(event.target.value)}
			onChange={(event) => {
				const entered = event.target.value;
				setDraft(entered);
				onChange(roundAmount(entered === "" ? null : Number(entered)));
			}}
			onBlur={() => setDraft(null)}
		/>
	);
}

function Field({
	label,
	children,
	required,
}: {
	label: string;
	children: ReactElement<{ id?: string; "aria-required"?: boolean }>;
	required?: boolean;
}) {
	const id = useId();
	return (
		<label htmlFor={id} className="flex min-w-0 flex-col gap-1.5 text-sm">
			<span>
				{label}
				{required && (
					<>
						{" "}
						<RequiredMark />
					</>
				)}
			</span>
			{cloneElement(children, { id, "aria-required": required })}
		</label>
	);
}

function RequiredMark() {
	return (
		<span aria-hidden="true" className="text-red-600 dark:text-red-400">
			*
		</span>
	);
}
