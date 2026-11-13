import type { PdfReviewLine, PdfVatMode } from "@/types/pdf-review";

const amountFormat = new Intl.NumberFormat("en-US", {
	useGrouping: false,
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
export const roundAmount = (value: number) =>
	Number(amountFormat.format(value)) || 0;

export const vatModes: { value: PdfVatMode; label: string; hint: string }[] = [
	{
		value: "none",
		label: "Pas de TVA",
		hint: "Toutes les lignes sont à 0 %.",
	},
	{
		value: "global",
		label: "Taux unique",
		hint: "Un seul taux pour tout le relevé.",
	},
	{
		value: "page",
		label: "Un taux par page",
		hint: "Chaque page du PDF a son taux.",
	},
	{
		value: "line",
		label: "Par ligne",
		hint: "Le taux se saisit sur chaque ligne.",
	},
];

export function vatFromRate(ht: number | null, rate: number | null) {
	return ht === null || rate === null ? null : roundAmount((ht * rate) / 100);
}

export function lineTtc(
	line: Pick<PdfReviewLine, "commission_amount" | "vat_amount">,
) {
	return line.commission_amount === null || line.vat_amount == null
		? null
		: roundAmount(line.commission_amount + line.vat_amount);
}

// Keeps commission_ttc derived from HT and VAT so the saved review stays consistent.
export function priced(line: PdfReviewLine): PdfReviewLine {
	return { ...line, commission_ttc: lineTtc(line) };
}

// A known rate recalculates the VAT; without one, a typed or printed VAT amount is kept.
export function withRate(line: PdfReviewLine, rate: number | null) {
	return priced({
		...line,
		vat_rate_pct: rate,
		vat_amount:
			rate === null
				? (line.vat_amount ?? null)
				: vatFromRate(line.commission_amount, rate),
	});
}

export function mostCommonRate(lines: PdfReviewLine[]) {
	const counts = new Map<number, number>();
	for (const line of lines)
		if (line.vat_rate_pct != null)
			counts.set(line.vat_rate_pct, (counts.get(line.vat_rate_pct) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function pagesOf(lines: PdfReviewLine[]) {
	return [...new Set(lines.map((line) => line.page))].sort((a, b) => a - b);
}

export function pageRates(lines: PdfReviewLine[]) {
	return new Map(
		pagesOf(lines).map((page) => [
			page,
			mostCommonRate(lines.filter((line) => line.page === page)),
		]),
	);
}
