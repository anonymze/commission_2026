import { Trash2, X } from "lucide-react";
import { useId } from "react";
import { PdfEntitySelect } from "@/components/pdf-entity-select";
import { PdfFieldWarning } from "@/components/pdf-field-warning";
import {
	Field,
	money,
	PdfAmountInput,
	RequiredMark,
} from "@/components/pdf-review-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lineTtc } from "@/lib/pdf-vat";
import type {
	PdfFieldReview,
	PdfReviewLine,
	PdfReviewOptions,
} from "@/types/pdf-review";

export function PdfReviewLineCard({
	line,
	number,
	options,
	busy,
	rateLocked,
	hideAdvisor,
	selected,
	suggestion,
	onSelect,
	onEdit,
	onChooseAdvisor,
	onRemove,
	onApplySuggestion,
	onDismissSuggestion,
}: {
	line: PdfReviewLine;
	number: number;
	options: PdfReviewOptions;
	busy: boolean;
	rateLocked: boolean;
	hideAdvisor: boolean;
	selected: boolean;
	suggestion: { count: number; label: string } | null;
	onSelect: (checked: boolean, range: boolean) => void;
	onEdit: (patch: Partial<PdfReviewLine>) => void;
	onChooseAdvisor: (id: string | null) => void;
	onRemove: () => void;
	onApplySuggestion: () => void;
	onDismissSuggestion: () => void;
}) {
	const ttcId = useId();
	const notes = (fields: PdfFieldReview["field"][]) =>
		(line.field_reviews || [])
			.filter((note) => fields.includes(note.field))
			.map((note) => note.reason);
	const ttc = lineTtc(line);
	const plural = suggestion && suggestion.count > 1 ? "s" : "";
	return (
		<div className="relative">
			<fieldset
				disabled={busy}
				className={`min-w-0 rounded-lg border p-3 sm:p-4 ${selected ? "border-primary/50 bg-primary/5" : "bg-muted/20"}`}
			>
				<legend className="flex items-center gap-2 px-1 text-sm font-medium">
					<input
						type="checkbox"
						aria-label={`Sélectionner la ligne ${number}`}
						title="Maj + clic pour sélectionner une plage"
						checked={selected}
						onChange={(event) =>
							onSelect(
								event.target.checked,
								(event.nativeEvent as MouseEvent).shiftKey,
							)
						}
						className="size-4 accent-primary"
					/>
					Ligne {number}
					<span className="font-normal text-muted-foreground">
						· page {line.page}
					</span>
				</legend>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={`Retirer la ligne ${number}`}
					title="Retirer cette ligne"
					className="absolute right-2 top-4 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
					onClick={onRemove}
				>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
					{!hideAdvisor && (
						<div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-5">
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-sm">
									Indépendant <RequiredMark />
								</p>
								<PdfFieldWarning
									label={`l'indépendant ligne ${number}`}
									messages={notes(["advisor_name", "advisor_code"])}
								/>
							</div>
							<PdfEntitySelect
								label={`Indépendant ligne ${number}`}
								required
								value={line.appUserId}
								options={options.users}
								match={line.match}
								error={
									!line.appUserId ? "Choisissez un indépendant." : undefined
								}
								disabled={busy}
								onChange={onChooseAdvisor}
							/>
							<p className="break-words text-xs text-muted-foreground">
								Lu : {line.advisor_name || "Absent du PDF"}
								{line.advisor_code ? ` · Code ${line.advisor_code}` : ""}
							</p>
							{suggestion && (
								<div
									role="status"
									className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs"
								>
									<span className="min-w-0 flex-1">
										"{suggestion.label}" apparaît sur {suggestion.count} autre
										{plural} ligne{plural}.
									</span>
									<Button size="sm" className="h-7" onClick={onApplySuggestion}>
										Appliquer à {suggestion.count} ligne{plural}
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										className="size-7"
										aria-label="Ignorer la suggestion"
										onClick={onDismissSuggestion}
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								</div>
							)}
						</div>
					)}
					<Field
						label="Type de commission"
						required
						className={`col-span-1 ${hideAdvisor ? "sm:col-span-4" : "sm:col-span-3"}`}
						error={
							!line.entry ? "Choisissez production ou encours." : undefined
						}
					>
						<select
							className="h-9 w-full rounded-md border bg-background px-3 text-sm aria-invalid:border-red-600 aria-invalid:bg-red-50 dark:aria-invalid:border-red-400 dark:aria-invalid:bg-red-950/30"
							value={line.entry || ""}
							onChange={(event) =>
								onEdit({
									entry:
										event.target.value === "production" ||
										event.target.value === "encours"
											? event.target.value
											: null,
								})
							}
						>
							<option value="">Choisir...</option>
							<option value="production">Production</option>
							<option value="encours">Encours</option>
						</select>
					</Field>
					<Field
						label="Client"
						className={`col-span-1 ${hideAdvisor ? "sm:col-span-8" : "sm:col-span-4"}`}
						warnings={notes(["client_name"])}
					>
						<Input
							value={line.client_name}
							onChange={(event) => onEdit({ client_name: event.target.value })}
						/>
					</Field>
					<Field
						label="Commission HT (€)"
						className="col-span-1 sm:col-span-3"
						warnings={notes(["commission_amount"])}
						required
						error={
							line.commission_amount === null
								? "Renseignez le montant."
								: undefined
						}
					>
						<PdfAmountInput
							value={line.commission_amount}
							onChange={(commission_amount) => onEdit({ commission_amount })}
						/>
					</Field>
					<Field
						label="TVA (%)"
						className="col-span-1 sm:col-span-3"
						warnings={notes(["vat_rate_pct"])}
						error={
							line.vat_rate_pct != null &&
							(line.vat_rate_pct < 0 || line.vat_rate_pct > 100)
								? "Entre 0 et 100 %."
								: undefined
						}
					>
						<PdfAmountInput
							min={0}
							max={100}
							disabled={rateLocked}
							title={
								rateLocked ? 'Taux défini dans "TVA du relevé"' : undefined
							}
							value={line.vat_rate_pct ?? null}
							onChange={(vat_rate_pct) => onEdit({ vat_rate_pct })}
						/>
					</Field>
					<Field
						label="Montant TVA (€)"
						className="col-span-1 sm:col-span-3"
						warnings={notes(["vat_amount"])}
					>
						<PdfAmountInput
							value={line.vat_amount ?? null}
							onChange={(vat_amount) => onEdit({ vat_amount })}
						/>
					</Field>
					<div className="col-span-1 flex min-w-0 flex-col gap-1.5 text-sm sm:col-span-3">
						<span id={ttcId}>Commission TTC (€)</span>
						<output
							aria-labelledby={ttcId}
							title="Calculée : HT + TVA"
							className="flex h-9 items-center rounded-md border border-dashed bg-muted/40 px-3 tabular-nums"
						>
							{ttc === null ? "-" : money(ttc)}
						</output>
					</div>
				</div>
			</fieldset>
		</div>
	);
}
