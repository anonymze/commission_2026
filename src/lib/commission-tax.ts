const amountFormat = new Intl.NumberFormat("en-US", {
	useGrouping: false,
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
export function commissionVatAmount({
	ht,
	vat,
	ttc,
}: {
	ht: number | null;
	vat?: number | null;
	ttc?: number | null;
}): number | null {
	if (vat != null && Number.isFinite(vat))
		return Number(amountFormat.format(vat)) || 0;
	if (ht === null || ttc == null || !Number.isFinite(ttc)) return null;
	return Number(amountFormat.format(ttc - ht)) || 0;
}
