const amountFormat = new Intl.NumberFormat("en-US", {
	useGrouping: false,
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
export function commissionVatAmount(
	ht: number | null,
	rate: number | null | undefined,
): number | null {
	if (ht === null || rate == null) return null;
	return Number(amountFormat.format((ht * rate) / 100)) || 0;
}
