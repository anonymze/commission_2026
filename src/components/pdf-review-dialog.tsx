import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	analyzePdfReview,
	matchPdfReview,
	pdfReviewOptionsQueryOptions,
	pdfReviewQueryOptions,
	savePdfReview,
} from "@/api/queries/pdf-review-queries";
import { PdfEntitySelect } from "@/components/pdf-entity-select";
import { PdfFieldWarning } from "@/components/pdf-field-warning";
import {
	Field,
	money,
	PdfAmountInput,
	RequiredMark,
	roundAmountOrNull,
} from "@/components/pdf-review-fields";
import { PdfReviewLineCard } from "@/components/pdf-review-line";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { commissionVatAmount } from "@/lib/commission-tax";
import {
	mostCommonRate,
	pageRates,
	pagesOf,
	priced,
	roundAmount,
	vatModes,
	withRate,
} from "@/lib/pdf-vat";
import type {
	PdfDocument,
	PdfFieldReview,
	PdfReview,
	PdfReviewInput,
	PdfReviewLine,
	PdfReviewOptions,
	PdfTarget,
	PdfVatMode,
} from "@/types/pdf-review";

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
								importEntry={query.data.entry}
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

const cents = (value: number) => Math.round(value * 100);
const sumAmounts = (values: (number | null | undefined)[]) =>
	values.reduce<number>((sum, value) => sum + cents(value ?? 0), 0) / 100;
const normalized = (value: string) =>
	value.trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
const isIncomplete = (line: PdfReviewLine) =>
	!line.appUserId || !line.entry || line.commission_amount === null;

function sharedUser(lines: PdfReviewLine[]) {
	const ids = new Set(lines.map((line) => line.appUserId));
	return ids.size === 1 ? ([...ids][0] ?? null) : null;
}

function mostCommonUser(lines: PdfReviewLine[]) {
	const counts = new Map<string, number>();
	for (const line of lines)
		if (line.appUserId)
			counts.set(line.appUserId, (counts.get(line.appUserId) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Lines whose advisor read in the PDF matches, by code first, then by name.
function sameAdvisorLines(lines: PdfReviewLine[], reference: PdfReviewLine) {
	const code = normalized(reference.advisor_code);
	const name = normalized(reference.advisor_name);
	return lines.filter(
		(line) =>
			line.id !== reference.id &&
			((code && normalized(line.advisor_code) === code) ||
				(name && normalized(line.advisor_name) === name)),
	);
}

function withoutNotes(
	line: PdfReviewLine,
	fields: PdfFieldReview["field"][],
	calculations: boolean,
) {
	return line.field_reviews?.filter(
		(note) =>
			!fields.includes(note.field) &&
			!(calculations && note.source === "calculation"),
	);
}

function PdfReviewEditor({
	initialDocument,
	target,
	review,
	importEntry,
	options,
	onDirty,
	onSaved,
}: {
	target: PdfTarget;
	review: PdfReview;
	importEntry: string;
	initialDocument: PdfDocument;
	options: PdfReviewOptions;
	onDirty: (dirty: boolean) => void;
	onSaved: () => void;
}) {
	const client = useQueryClient();
	const vatId = useId();
	const [document, setDocument] = useState<PdfDocument>(() => {
		const ht = roundAmountOrNull(initialDocument.commission_total);
		return {
			...initialDocument,
			commission_total: ht,
			vat_mode: initialDocument.vat_mode ?? "line",
			commission_total_ttc:
				initialDocument.commission_total_ttc ??
				(ht !== null && initialDocument.vat_total != null
					? roundAmount(ht + initialDocument.vat_total)
					: null),
		};
	});
	const [supplierId, setSupplierId] = useState(review.supplierId);
	const [lines, setLines] = useState<PdfReviewLine[]>(() =>
		review.lines.map((line) => {
			const commission_amount = roundAmountOrNull(line.commission_amount);
			return priced({
				...line,
				commission_amount,
				vat_amount: commissionVatAmount({
					ht: commission_amount,
					vat: line.vat_amount,
					ttc: line.commission_ttc,
				}),
			});
		}),
	);
	const [selected, setSelected] = useState<Set<string>>(() => new Set());
	const [anchor, setAnchor] = useState<string | null>(null);
	const [focusIds, setFocusIds] = useState<Set<string> | null>(null);
	const [suggestion, setSuggestion] = useState<{
		lineId: string;
		userId: string;
	} | null>(null);
	const [bulkUser, setBulkUser] = useState<string | null>(null);
	const [bulkEntry, setBulkEntry] = useState<"" | "production" | "encours">("");
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
	const match = useMutation({
		mutationFn: (input: PdfReviewInput) =>
			matchPdfReview({ data: { ...target, input } }),
		onSuccess: (result) => setLines(result.lines.map(priced)),
		onError: () =>
			setError(
				"Correspondances automatiques indisponibles. Complétez les lignes manuellement.",
			),
	});
	const busy = save.isPending || match.isPending;
	const mode = document.vat_mode ?? "line";
	const pages = pagesOf(lines);
	const ratesByPage = pageRates(lines);
	const singleAdvisor = !!document.single_advisor;
	const numbers = new Map(lines.map((line, index) => [line.id, index + 1]));
	const visible = focusIds
		? lines.filter((line) => focusIds.has(line.id))
		: lines;
	const incomplete = lines.filter(isIncomplete).length;
	const withoutAdvisor = lines.filter((line) => !line.appUserId);
	const htTotal = sumAmounts(lines.map((line) => line.commission_amount));
	const vatTotal = sumAmounts(lines.map((line) => line.vat_amount));
	const ttcTotal = (cents(htTotal) + cents(vatTotal)) / 100;
	const missingVat = lines.filter((line) => line.vat_amount == null).length;
	const totalTtc = document.commission_total_ttc ?? null;
	const balanced = totalTtc !== null && cents(ttcTotal) === cents(totalTtc);
	const remarks = [...new Set(review.extracted?.warnings ?? [])];
	const invalidVat = lines.some(
		(line) =>
			line.vat_rate_pct != null &&
			(line.vat_rate_pct < 0 || line.vat_rate_pct > 100),
	);
	const canValidate =
		!!supplierId &&
		lines.length > 0 &&
		!incomplete &&
		!invalidVat &&
		totalTtc !== null;
	const messages = (
		item: { field_reviews?: PdfFieldReview[] },
		fields: PdfFieldReview["field"][],
	) =>
		(item.field_reviews || [])
			.filter((note) => fields.includes(note.field))
			.map((note) => note.reason);
	const vatWarnings = messages(document, ["vat_total", "vat_rate_pct"]);
	if (
		!missingVat &&
		document.vat_total != null &&
		cents(vatTotal) !== cents(document.vat_total)
	)
		vatWarnings.push(
			`La somme des TVA des lignes est ${money(vatTotal)}, contre ${money(document.vat_total)} pour le relevé. Vérifiez les taux et les montants des lignes. Vous pouvez enregistrer et valider.`,
		);
	function touched() {
		onDirty(true);
		setError("");
	}
	function editDocument(patch: Partial<PdfDocument>) {
		setDocument((previous) => ({
			...previous,
			...patch,
			field_reviews: previous.field_reviews?.filter(
				(note) => !Object.keys(patch).includes(note.field),
			),
		}));
		touched();
	}
	function changeLines(update: (previous: PdfReviewLine[]) => PdfReviewLine[]) {
		setLines(update);
		touched();
	}
	function revise(line: PdfReviewLine, patch: Partial<PdfReviewLine>) {
		const next = { ...line, ...patch };
		const financial =
			"commission_amount" in patch ||
			"vat_amount" in patch ||
			"vat_rate_pct" in patch;
		return {
			...("commission_amount" in patch || "vat_rate_pct" in patch
				? withRate(next, next.vat_rate_pct ?? null)
				: priced(next)),
			field_reviews: withoutNotes(
				line,
				[
					...(Object.keys(patch) as PdfFieldReview["field"][]),
					...("appUserId" in patch
						? (["advisor_name", "advisor_code"] as const)
						: []),
				],
				financial,
			),
		};
	}
	function editLine(id: string, patch: Partial<PdfReviewLine>) {
		changeLines((previous) =>
			previous.map((line) => (line.id === id ? revise(line, patch) : line)),
		);
	}
	function assign(ids: Set<string>, patch: Partial<PdfReviewLine>) {
		changeLines((previous) =>
			previous.map((line) => (ids.has(line.id) ? revise(line, patch) : line)),
		);
	}
	function applyRates(rateOf: (line: PdfReviewLine) => number | null) {
		changeLines((previous) =>
			previous.map((line) => ({
				...withRate(line, rateOf(line)),
				field_reviews: withoutNotes(line, ["vat_rate_pct", "vat_amount"], true),
			})),
		);
	}
	function changeVatMode(next: PdfVatMode) {
		if (next === mode) return;
		if (next === "none") {
			editDocument({ vat_mode: next, vat_rate_pct: 0 });
			applyRates(() => 0);
		} else if (next === "global") {
			const rate =
				mode === "none"
					? null
					: (document.vat_rate_pct ?? mostCommonRate(lines));
			editDocument({ vat_mode: next, vat_rate_pct: rate });
			applyRates(() => rate);
		} else if (next === "page") {
			const rates = mode === "none" ? new Map() : ratesByPage;
			editDocument({ vat_mode: next });
			applyRates((line) => rates.get(line.page) ?? null);
		} else editDocument({ vat_mode: next });
	}
	function select(line: PdfReviewLine, checked: boolean, range: boolean) {
		const from = visible.findIndex((item) => item.id === anchor);
		const to = visible.findIndex((item) => item.id === line.id);
		const ids =
			range && from !== -1
				? visible
						.slice(Math.min(from, to), Math.max(from, to) + 1)
						.map((item) => item.id)
				: [line.id];
		setSelected((previous) => {
			const next = new Set(previous);
			for (const id of ids) {
				if (checked) next.add(id);
				else next.delete(id);
			}
			return next;
		});
		setAnchor(line.id);
	}
	function selectOnly(ids: string[]) {
		setSelected(new Set(ids));
		setAnchor(null);
	}
	function applyBulk() {
		const count = selected.size;
		assign(selected, {
			...(bulkUser ? { appUserId: bulkUser } : {}),
			...(bulkEntry ? { entry: bulkEntry } : {}),
		});
		toast.success(
			`${count} ligne${count > 1 ? "s" : ""} mise${count > 1 ? "s" : ""} à jour`,
		);
		selectOnly([]);
		setBulkUser(null);
		setBulkEntry("");
	}
	function toggleSingleAdvisor(on: boolean) {
		editDocument({ single_advisor: on });
		const user = mostCommonUser(lines);
		if (on && user)
			assign(new Set(lines.map((line) => line.id)), { appUserId: user });
		setSuggestion(null);
	}
	function changeSupplier(id: string | null) {
		if (id === supplierId) return;
		const nextLines: PdfReviewLine[] = lines.map((line) => ({
			...line,
			appUserId: singleAdvisor ? line.appUserId : null,
			entry: importEntry === "production_encours" ? null : line.entry,
			match: { kind: "unmatched", candidates: [] },
		}));
		setSupplierId(id);
		setDocument((previous) => ({
			...previous,
			field_reviews: previous.field_reviews?.filter(
				(note) => note.field !== "supplier_name",
			),
		}));
		setLines(nextLines);
		setSuggestion(null);
		touched();
		if (id && nextLines.length) {
			match.mutate({
				...input("draft"),
				supplierId: id,
				lines: nextLines.map(({ match: _match, ...line }) => line),
			});
		}
	}
	function addLine() {
		const id = crypto.randomUUID();
		const rate =
			mode === "none"
				? 0
				: mode === "global"
					? (document.vat_rate_pct ?? null)
					: mode === "page"
						? (ratesByPage.get(1) ?? null)
						: null;
		changeLines((previous) => [
			...previous,
			withRate(
				{
					id,
					client_name: "",
					advisor_name: "",
					advisor_code: "",
					product: "",
					operation_date: "",
					commission_amount: null,
					page: 1,
					appUserId: singleAdvisor ? sharedUser(previous) : null,
					entry: null,
					match: { kind: "unmatched", candidates: [] },
				},
				rate,
			),
		]);
		if (focusIds) setFocusIds(new Set([...focusIds, id]));
	}
	const allVisibleSelected =
		visible.length > 0 && visible.every((line) => selected.has(line.id));
	const someVisibleSelected = visible.some((line) => selected.has(line.id));
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
				{((totalTtc !== null && !balanced) || remarks.length > 0) && (
					<Alert
						role="status"
						className="border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
					>
						<TriangleAlert />
						<AlertTitle>Points à vérifier</AlertTitle>
						<AlertDescription className="text-amber-900 dark:text-amber-200">
							{totalTtc !== null && !balanced && (
								<p className="font-medium">
									La somme des lignes ({money(ttcTotal)} TTC) ne correspond pas
									au total du relevé ({money(totalTtc)} TTC) : écart de{" "}
									{money(ttcTotal - totalTtc)}. Vérifiez qu'aucune ligne ne
									manque ou n'est en double.
								</p>
							)}
							{remarks.length > 0 && (
								<details open={remarks.length <= 2} className="w-full">
									<summary className="cursor-pointer underline-offset-4 hover:underline">
										Remarques de l'analyse ({remarks.length})
									</summary>
									<ul className="mt-1 list-disc space-y-1 pl-4">
										{remarks.map((remark) => (
											<li key={remark}>{remark}</li>
										))}
									</ul>
								</details>
							)}
							<p className="text-xs">
								Ces points ne bloquent ni l'enregistrement ni la validation.
							</p>
						</AlertDescription>
					</Alert>
				)}
				<fieldset
					disabled={busy}
					className="min-w-0 space-y-4 rounded-lg border p-3 sm:p-4"
				>
					<legend className="px-1 text-sm font-semibold">Relevé</legend>
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="min-w-0 space-y-1.5">
							<p className="text-sm">
								Fournisseur <RequiredMark />
							</p>
							<PdfFieldWarning
								label="le fournisseur"
								messages={messages(document, ["supplier_name"])}
							/>
							<PdfEntitySelect
								label="Fournisseur"
								required
								value={supplierId}
								disabled={busy}
								options={options.suppliers}
								match={review.supplierMatch}
								error={!supplierId ? "Choisissez un fournisseur." : undefined}
								onChange={changeSupplier}
							/>
							<p className="text-xs text-muted-foreground">
								Lu dans le PDF :{" "}
								{review.extracted?.supplier_name || "Non identifié"}
							</p>
							{match.isPending && (
								<p role="status" className="text-xs text-muted-foreground">
									Recherche des indépendants et des types de commission...
								</p>
							)}
						</div>
						<Field
							label="Total commissions TTC (€)"
							warnings={messages(document, [
								"commission_total",
								"commission_total_ttc",
							])}
							required
							error={
								totalTtc === null
									? "Renseignez le total TTC du relevé."
									: undefined
							}
							hint={
								document.commission_total === null
									? undefined
									: `Total HT lu dans le PDF : ${money(document.commission_total)}`
							}
						>
							<PdfAmountInput
								value={totalTtc}
								onChange={(commission_total_ttc) =>
									editDocument({ commission_total_ttc })
								}
							/>
						</Field>
					</div>
					<div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
						<fieldset className="min-w-0 space-y-2">
							<legend className="flex flex-wrap items-center gap-2 text-sm">
								TVA du relevé
								<PdfFieldWarning label="la TVA" messages={vatWarnings} />
							</legend>
							<div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
								{vatModes.map((option) => (
									<Button
										key={option.value}
										type="button"
										size="sm"
										variant={mode === option.value ? "default" : "outline"}
										aria-pressed={mode === option.value}
										onClick={() => changeVatMode(option.value)}
									>
										{option.label}
									</Button>
								))}
							</div>
							{mode === "global" && (
								<div className="flex items-center gap-2 text-sm">
									<label htmlFor={`${vatId}-rate`}>
										Taux appliqué à toutes les lignes
									</label>
									<PdfAmountInput
										id={`${vatId}-rate`}
										min={0}
										max={100}
										className="h-8 w-24"
										value={document.vat_rate_pct ?? null}
										onChange={(rate) => {
											editDocument({ vat_rate_pct: rate });
											applyRates(() => rate);
										}}
									/>
									%
								</div>
							)}
							{mode === "page" && (
								<div className="flex flex-wrap gap-x-4 gap-y-2">
									{pages.map((page) => (
										<div
											key={page}
											className="flex items-center gap-1.5 text-sm"
										>
											<label htmlFor={`${vatId}-page-${page}`}>
												Page {page}
											</label>
											<PdfAmountInput
												id={`${vatId}-page-${page}`}
												min={0}
												max={100}
												className="h-8 w-20"
												value={ratesByPage.get(page) ?? null}
												onChange={(rate) =>
													applyRates((line) =>
														line.page === page
															? rate
															: (line.vat_rate_pct ?? null),
													)
												}
											/>
											%
										</div>
									))}
								</div>
							)}
							<p className="text-xs text-muted-foreground">
								{vatModes.find((option) => option.value === mode)?.hint} Le
								montant de TVA reste modifiable sur chaque ligne.
							</p>
						</fieldset>
						<div className="min-w-0 space-y-2">
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									className="size-4 accent-primary"
									checked={singleAdvisor}
									onChange={(event) =>
										toggleSingleAdvisor(event.target.checked)
									}
								/>
								Relevé d'un seul indépendant
							</label>
							{singleAdvisor ? (
								<PdfEntitySelect
									label="Indépendant du relevé"
									required
									value={sharedUser(lines)}
									options={options.users}
									disabled={busy}
									error={
										sharedUser(lines)
											? undefined
											: "Choisissez l'indépendant de toutes les lignes."
									}
									onChange={(id) =>
										assign(new Set(lines.map((line) => line.id)), {
											appUserId: id,
										})
									}
								/>
							) : (
								<p className="text-xs text-muted-foreground">
									Cochez pour choisir l'indépendant une seule fois pour toutes
									les lignes.
								</p>
							)}
						</div>
					</div>
				</fieldset>
				<section aria-labelledby={`${vatId}-lines`} className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 id={`${vatId}-lines`} className="text-sm font-semibold">
							Lignes de commissions ({lines.length})
						</h3>
						<span className="text-sm text-muted-foreground">
							{incomplete
								? `${incomplete} ligne${incomplete > 1 ? "s" : ""} à compléter`
								: "Toutes les lignes sont renseignées"}
						</span>
					</div>
					<div className="-mx-1 space-y-2 border-b bg-background px-1 pb-2 sm:sticky sm:top-0 sm:z-10">
						<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									className="size-4 accent-primary"
									ref={(element) => {
										if (element)
											element.indeterminate =
												someVisibleSelected && !allVisibleSelected;
									}}
									checked={allVisibleSelected}
									onChange={(event) =>
										selectOnly(
											event.target.checked
												? visible.map((line) => line.id)
												: [],
										)
									}
								/>
								Tout sélectionner
							</label>
							{!singleAdvisor && withoutAdvisor.length > 0 && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-7"
									onClick={() =>
										selectOnly(withoutAdvisor.map((line) => line.id))
									}
								>
									Sélectionner les lignes sans indépendant (
									{withoutAdvisor.length})
								</Button>
							)}
							{pages.length > 1 && (
								<select
									aria-label="Sélectionner les lignes d'une page"
									className="h-7 rounded-md border bg-background px-2 text-sm"
									value=""
									onChange={(event) =>
										selectOnly(
											lines
												.filter(
													(line) => line.page === Number(event.target.value),
												)
												.map((line) => line.id),
										)
									}
								>
									<option value="">Sélectionner une page...</option>
									{pages.map((page) => (
										<option key={page} value={page}>
											Page {page} (
											{lines.filter((line) => line.page === page).length})
										</option>
									))}
								</select>
							)}
							<label className="ml-auto flex items-center gap-2">
								<input
									type="checkbox"
									className="size-4 accent-primary"
									checked={!!focusIds}
									onChange={(event) =>
										setFocusIds(
											event.target.checked
												? new Set(
														lines.filter(isIncomplete).map((line) => line.id),
													)
												: null,
										)
									}
								/>
								À compléter uniquement
							</label>
						</div>
						{selected.size > 0 && (
							<div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
								<span className="text-sm font-medium">
									{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
								</span>
								{!singleAdvisor && (
									<div className="w-full sm:w-64">
										<PdfEntitySelect
											label="Indépendant à appliquer"
											quiet
											value={bulkUser}
											options={options.users}
											disabled={busy}
											onChange={setBulkUser}
										/>
									</div>
								)}
								<select
									aria-label="Type à appliquer"
									className="h-9 rounded-md border bg-background px-3 text-sm"
									value={bulkEntry}
									onChange={(event) =>
										setBulkEntry(
											event.target.value as "" | "production" | "encours",
										)
									}
								>
									<option value="">Type inchangé</option>
									<option value="production">Production</option>
									<option value="encours">Encours</option>
								</select>
								<Button
									type="button"
									size="sm"
									disabled={busy || (!bulkUser && !bulkEntry)}
									onClick={applyBulk}
								>
									Appliquer
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => selectOnly([])}
								>
									Annuler
								</Button>
							</div>
						)}
					</div>
					{visible.map((line) => {
						const pending =
							suggestion?.lineId === line.id
								? sameAdvisorLines(lines, line).filter(
										(other) => other.appUserId !== suggestion.userId,
									)
								: [];
						return (
							<PdfReviewLineCard
								key={line.id}
								line={line}
								number={numbers.get(line.id) ?? 0}
								options={options}
								busy={busy}
								rateLocked={mode !== "line"}
								hideAdvisor={singleAdvisor}
								selected={selected.has(line.id)}
								suggestion={
									pending.length
										? {
												count: pending.length,
												label: line.advisor_name || line.advisor_code,
											}
										: null
								}
								onSelect={(checked, range) => select(line, checked, range)}
								onEdit={(patch) => editLine(line.id, patch)}
								onChooseAdvisor={(id) => {
									editLine(line.id, { appUserId: id });
									setSuggestion(id ? { lineId: line.id, userId: id } : null);
								}}
								onRemove={() => {
									changeLines((previous) =>
										previous.filter((item) => item.id !== line.id),
									);
									setSelected((previous) => {
										const next = new Set(previous);
										next.delete(line.id);
										return next;
									});
								}}
								onApplySuggestion={() => {
									if (!suggestion) return;
									assign(new Set(pending.map((other) => other.id)), {
										appUserId: suggestion.userId,
									});
									toast.success(
										`Indépendant appliqué à ${pending.length} ligne${pending.length > 1 ? "s" : ""}`,
									);
									setSuggestion(null);
								}}
								onDismissSuggestion={() => setSuggestion(null)}
							/>
						);
					})}
					{focusIds && !visible.length && (
						<p className="text-sm text-muted-foreground">
							Aucune ligne à compléter.
						</p>
					)}
					<Button
						variant="outline"
						size="sm"
						disabled={busy || lines.length >= 500}
						onClick={addLine}
					>
						<Plus className="h-4 w-4" />
						Ajouter une ligne manquante
					</Button>
				</section>
			</div>
			<div className="space-y-3 border-t pt-3">
				<div className="flex flex-wrap justify-between gap-2 text-sm">
					<span>
						Somme des lignes : HT <strong>{money(htTotal)}</strong> · TVA{" "}
						<strong>{money(vatTotal)}</strong> · TTC{" "}
						<strong>{money(ttcTotal)}</strong>
					</span>
					<span className="text-muted-foreground">
						Total TTC du relevé :{" "}
						<strong>
							{totalTtc === null ? "à renseigner" : money(totalTtc)}
						</strong>
					</span>
				</div>
				{missingVat > 0 && (
					<p className="text-sm text-amber-700 dark:text-amber-400">
						TVA non renseignée sur {missingVat} ligne{missingVat > 1 ? "s" : ""}{" "}
						: le TTC des lignes est incomplet.
					</p>
				)}
				{totalTtc !== null && !balanced && (
					<p
						role="status"
						className="text-sm text-amber-700 dark:text-amber-400"
					>
						Écart de {money(ttcTotal - totalTtc)} par rapport au total TTC du
						relevé. Vous pouvez enregistrer et valider.
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
						par ligne, les montants des commissions et le total TTC du relevé.
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
