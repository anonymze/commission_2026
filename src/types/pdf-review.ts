export type PdfMatch = {
	kind: "exact" | "suggested" | "ambiguous" | "unmatched";
	candidates: { id: string; label: string; reason: string }[];
};
export type PdfFieldReview = {
	field:
		| "supplier_name"
		| "commission_total"
		| "vat_total"
		| "vat_rate_pct"
		| "client_name"
		| "advisor_name"
		| "advisor_code"
		| "product"
		| "operation_date"
		| "commission_amount";
	reason: string;
	source?: "comparison" | "calculation";
};
export type PdfRow = {
	client_name: string;
	advisor_name: string;
	advisor_code: string;
	product: string;
	operation_date: string;
	commission_amount: number | null;
	vat_rate_pct?: number | null;
	vat_amount?: number | null;
	commission_ttc?: number | null;
	field_reviews?: PdfFieldReview[];
	commission_labels?: string[];
	page: number;
};
export type PdfDocument = {
	supplier_name: string;
	document_reference: string;
	commission_total: number | null;
	vat_rate_pct?: number | null;
	vat_total?: number | null;
	commission_total_ttc?: number | null;
	field_reviews?: PdfFieldReview[];
};
export type PdfReviewLine = PdfRow & {
	id: string;
	appUserId: string | null;
	entry: "production" | "encours" | null;
	match: PdfMatch;
};
export type PdfReview = {
	version: 1;
	revision: string;
	status: "processing" | "failed" | "draft" | "validated";
	model: string;
	startedAt: string;
	analyzedAt?: string;
	validatedAt?: string;
	error?: string;
	extracted: (PdfDocument & { rows: PdfRow[]; warnings: string[] }) | null;
	document: PdfDocument | null;
	supplierId: string | null;
	supplierMatch: PdfMatch;
	lines: PdfReviewLine[];
};
export type PdfReviewInput = {
	revision: string;
	action: "draft" | "validate";
	supplierId: string | null;
	document: PdfDocument;
	lines: Omit<PdfReviewLine, "match">[];
};
export type PdfTarget = { importId: string; fileId: string };
export type PdfReviewResponse = {
	review: PdfReview | null;
	filename?: string;
	url?: string;
	entry: string;
};
export type PdfReviewOptions = {
	suppliers: { id: string; label: string }[];
	users: { id: string; label: string }[];
};
