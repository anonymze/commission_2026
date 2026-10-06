import { queryOptions } from "@tanstack/react-query";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type {
	PdfReview,
	PdfReviewInput,
	PdfReviewLine,
	PdfReviewOptions,
	PdfReviewResponse,
	PdfTarget,
} from "@/types/pdf-review";
import { api } from "../_config";

const authenticated = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		if (!session) throw new Error("Veuillez vous reconnecter.");
		return next();
	},
);
const targetSchema = z.object({
	importId: z.uuid(),
	fileId: z.string().min(1).max(100),
});
const base = (target: PdfTarget) =>
	`/api/commission-imports/pdf/${target.importId}/${encodeURIComponent(target.fileId)}`;
function fail(error: unknown): never {
	const parsed = z
		.object({ data: z.object({ message: z.string() }) })
		.safeParse(error);
	throw new Error(
		parsed.success
			? parsed.data.data.message
			: "Impossible de traiter ce PDF. Réessayez.",
	);
}
export const getPdfReview = createServerFn({ method: "GET" })
	.middleware([authenticated])
	.inputValidator(targetSchema)
	.handler(async ({ data }) => {
		try {
			return (await api.get<PdfReviewResponse>(base(data))).data;
		} catch (error) {
			fail(error);
		}
	});
export const analyzePdfReview = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.inputValidator(targetSchema)
	.handler(async ({ data }) => {
		try {
			return (await api.post<{ review: PdfReview }>(`${base(data)}/analyze`))
				.data;
		} catch (error) {
			fail(error);
		}
	});
const inputSchema = targetSchema.extend({
	input: z.custom<PdfReviewInput>(
		(value) => !!value && typeof value === "object",
	),
});
export const savePdfReview = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.inputValidator(inputSchema)
	.handler(async ({ data }) => {
		try {
			return (
				await api.post<{ review: PdfReview }>(
					`${base(data)}/review`,
					data.input,
				)
			).data;
		} catch (error) {
			fail(error);
		}
	});
export const matchPdfReview = createServerFn({ method: "POST" })
	.middleware([authenticated])
	.inputValidator(inputSchema)
	.handler(async ({ data }) => {
		try {
			return (
				await api.post<{ lines: PdfReviewLine[] }>(
					`${base(data)}/match`,
					data.input,
				)
			).data;
		} catch (error) {
			fail(error);
		}
	});
export const getPdfOptions = createServerFn({ method: "GET" })
	.middleware([authenticated])
	.handler(async () => {
		try {
			return (
				await api.get<PdfReviewOptions>("/api/commission-imports/pdf-options")
			).data;
		} catch (error) {
			fail(error);
		}
	});
export const pdfReviewQueryOptions = (target: PdfTarget) =>
	queryOptions({
		queryKey: ["pdf-review", target],
		queryFn: () => getPdfReview({ data: target }),
		staleTime: 0,
	});
export const pdfReviewOptionsQueryOptions = () =>
	queryOptions({
		queryKey: ["pdf-review-options"],
		queryFn: getPdfOptions,
		staleTime: 60_000,
	});
