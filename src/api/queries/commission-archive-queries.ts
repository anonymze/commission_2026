import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api, handleApiError } from "../_config";

const filtersSchema = z.object({
	page: z.number().int().min(1).max(1000000),
	search: z.string().trim().max(120),
	month: z.string().regex(/^(?:[1-9]\d{3}-(?:0[1-9]|1[0-2]))?$/),
});

const resultSchema = z.object({
	docs: z.array(
		z.object({ id: z.string(), date: z.string(), name: z.string() }),
	),
	page: z.number(),
	totalPages: z.number(),
	totalDocs: z.number(),
});

const getArchives = createServerFn({ method: "GET" })
	.inputValidator(filtersSchema)
	.handler(async ({ data }) => {
		try {
			const params = new URLSearchParams({
				page: String(data.page),
				search: data.search,
				month: data.month,
			});
			const response = await api.get<unknown>(
				`/api/commissions/archives?${params}`,
			);
			return resultSchema.parse(response.data);
		} catch (error) {
			handleApiError(error);
		}
	});

export const commissionArchivesQueryOptions = (
	filters: z.infer<typeof filtersSchema>,
) =>
	queryOptions({
		queryKey: ["commissions", "archives", filters],
		queryFn: () => getArchives({ data: filters }),
	});

export const restoreCommissionQuery = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		try {
			const response = await api.post<unknown>(
				"/api/commissions/restore",
				data,
			);
			return z.object({ id: z.string() }).parse(response.data);
		} catch (error) {
			handleApiError(error);
		}
	});
