import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { PaginatedResponse } from "@/types/response";
import type { Supplier } from "@/types/supplier";
import { api } from "../_config";

export const getSuppliersQuery = createServerFn({ method: "GET" }).handler(
	async () => {
		const response = await api.get<PaginatedResponse<Supplier>>(
			"/api/suppliers",
			{
				params: {
					sort: "name",
					limit: 0,
				},
			},
		);
		return response.data;
	},
);

export const suppliersQueryOptions = () =>
	queryOptions({
		queryKey: ["suppliers"],
		queryFn: getSuppliersQuery,
	});
