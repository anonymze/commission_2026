import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type {
	AppUsersCommissionsCode,
	Commission,
	CommissionImport,
	ProcessCommissionsResponse,
	SuppliersCommissionsColumn,
} from "@/types/commission";
import type { PaginatedResponse } from "@/types/response";
import type { Supplier } from "@/types/supplier";
import { api, handleApiError } from "../_config";

export const getCommissionsQuery = createServerFn({ method: "GET" }).handler(
	async () => {
		try {
			const response =
				await api.get<PaginatedResponse<Commission>>("/api/commissions");
			return response.data;
		} catch (error) {
			handleApiError(error);
		}
	},
);

export const commissionsQueryOptions = () =>
	queryOptions({
		queryKey: ["commissions"],
		queryFn: getCommissionsQuery,
	});

export const createCommissionQuery = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			app_user: string;
			commission_supplier_ids: string[];
			date: string;
			structured_product: boolean;
			title?: string | undefined;
			up_front?: number | undefined;
			broqueur?: string | undefined;
		}) => data,
	)
	.handler(async ({ data }) => {
		console.log("lààà");
		const response = await api.post(
			"/api/commissions/commission-suppliers",
			data,
		);
		return response.data;
	});

export const deleteCommissionQuery = createServerFn({ method: "POST" })
	.inputValidator((commissionId: Commission["id"]) => commissionId)
	.handler(async ({ data: commissionId }) => {
		const response = await api.delete(`/api/commissions/${commissionId}`);
		return response.data;
	});

export const getCommissionExportQuery = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { commissionId: Commission["id"]; email?: string | undefined }) =>
			data,
	)
	.handler(async ({ data: { commissionId, email } }) => {
		const url = email
			? `${process.env.API_URL}/api/commissions/export/${commissionId}?email=${email}`
			: `${process.env.API_URL}/api/commissions/export/${commissionId}`;

		const response = await fetch(url, {
			headers: {
				Authorization: `admins API-Key ${process.env.API_ADMIN_KEY}`,
			},
		});

		if (!response.ok) {
			throw new Error("Export failed");
		}

		// If email sent, no download needed
		if (email) {
			return { email: true };
		}

		// Get ArrayBuffer and convert to base64
		const arrayBuffer = await response.arrayBuffer();
		const base64 = Buffer.from(arrayBuffer).toString("base64");

		return {
			base64,
			contentType: response.headers.get("content-type") || "application/octet-stream",
		};
	});

export const getCommissionImportUserQuery = createServerFn({ method: "GET" })
	.inputValidator((userId: string) => userId)
	.handler(async ({ data: userId }) => {
		try {
			const response = await api.get<ProcessCommissionsResponse>(
				`/api/commission-imports/${userId}`,
			);
			return response.data;
		} catch (error: any) {
			// Return error in ProcessCommissionsResponse format
			return {
				status: "error",
				message: error.data?.message || error.message || "Erreur inconnue",
				code: error.data?.code || "INTERNAL_ERROR",
				errors: error.data?.errors || [],
			} as ProcessCommissionsResponse;
		}
	});

export const commissionImportUserQueryOptions = (userId: string) =>
	queryOptions({
		queryKey: ["commission-import-user", userId],
		queryFn: () => getCommissionImportUserQuery({ data: userId }),
		enabled: !!userId,
		staleTime: 0, // Always refetch to get latest codes/imports
	});

export const getAppUserCommissionsCodeQuery = createServerFn({
	method: "GET",
}).handler(async () => {
	const response = await api.get<PaginatedResponse<AppUsersCommissionsCode>>(
		"/api/app-users-commissions-code",
		{
			params: {
				sort: "app_user.lastname",
			},
		},
	);
	return response.data;
});

export const appUserCommissionsCodeQueryOptions = () =>
	queryOptions({
		queryKey: ["app-user-commissions-code"],
		queryFn: getAppUserCommissionsCodeQuery,
	});

export const createAppUserCommissionCodeQuery = createServerFn({
	method: "POST",
})
	.inputValidator(
		(data: {
			app_user: string;
			code: { code: string; id?: string | null; supplier: Supplier["id"] }[];
		}) => data,
	)
	.handler(async ({ data }) => {
		const response = await api.post(
			"/api/app-users-commissions-code/create",
			data,
		);
		return response.data;
	});

export const updateAppUserCommissionCodeQuery = createServerFn({
	method: "POST",
})
	.inputValidator(
		(data: {
			app_user: string;
			code: { code: string; id?: string | null; supplier: Supplier["id"] }[];
			appUserCodeId: AppUsersCommissionsCode["id"];
		}) => data,
	)
	.handler(async ({ data }) => {
		const response = await api.patch(
			`/api/app-users-commissions-code/${data.appUserCodeId}`,
			data,
		);
		return response.data;
	});

export const deleteAppUserCommissionCodeQuery = createServerFn({
	method: "POST",
})
	.inputValidator(
		(appUserCodeId: AppUsersCommissionsCode["id"]) => appUserCodeId,
	)
	.handler(async ({ data: appUserCodeId }) => {
		const response = await api.delete(
			`/api/app-users-commissions-code/${appUserCodeId}`,
		);
		return response.data;
	});

export const getSupplierCommissionsColumnQuery = createServerFn({
	method: "POST",
})
	.inputValidator((filters: any) => filters)
	.handler(async ({ data: filters }) => {
		const response = await api.get<
			PaginatedResponse<SuppliersCommissionsColumn>
		>("/api/suppliers-commissions-column", { params: filters });
		return response.data;
	});

export const supplierCommissionsColumnQueryOptions = () =>
	queryOptions({
		queryKey: ["supplier-commissions-column"],
		queryFn: () => getSupplierCommissionsColumnQuery({ data: {} }),
	});

export const createSupplierCommissionColumnQuery = createServerFn({
	method: "POST",
})
	.inputValidator(
		(
			data: Pick<
				SuppliersCommissionsColumn,
				"production" | "encours" | "production_encours"
			> & { supplier: Supplier["id"] },
		) => data,
	)
	.handler(async ({ data }) => {
		const response = await api.post("/api/suppliers-commissions-column", data);
		return response.data;
	});

export const updateSupplierCommissionColumnQuery = createServerFn({
	method: "POST",
})
	.inputValidator(
		(
			data: Pick<
				SuppliersCommissionsColumn,
				"production" | "encours" | "production_encours"
			> & {
				supplier: Supplier["id"];
				supplierColumnId: SuppliersCommissionsColumn["id"];
			},
		) => data,
	)
	.handler(async ({ data }) => {
		const response = await api.patch(
			`/api/suppliers-commissions-column/${data.supplierColumnId}`,
			data,
		);
		return response.data;
	});

export const deleteSupplierCommissionColumnQuery = createServerFn({
	method: "POST",
})
	.inputValidator(
		(supplierCommissionColumn: SuppliersCommissionsColumn["id"]) =>
			supplierCommissionColumn,
	)
	.handler(async ({ data: supplierCommissionColumn }) => {
		const response = await api.delete(
			`/api/suppliers-commissions-column/${supplierCommissionColumn}`,
		);
		return response.data;
	});

export const getCommissionsImportQuery = createServerFn({ method: "POST" })
	.inputValidator((filters: any) => filters)
	.handler(async ({ data: filters }) => {
		try {
			const response = await api.get<PaginatedResponse<CommissionImport>>(
				"/api/commission-imports",
				{
					params: filters,
				},
			);
			return response.data;
		} catch (error: any) {
			console.error("Error fetching commission imports:", error);
			// Return empty paginated response on error
			return {
				docs: [],
				totalDocs: 0,
				limit: 10,
				page: 1,
				totalPages: 0,
				hasNextPage: false,
				hasPrevPage: false,
				nextPage: null,
				prevPage: null,
				pagingCounter: 0,
			} as PaginatedResponse<CommissionImport>;
		}
	});

export const deleteCommissionImportQuery = createServerFn({ method: "POST" })
	.inputValidator(
		(commissionImportId: CommissionImport["id"]) => commissionImportId,
	)
	.handler(async ({ data: commissionImportId }) => {
		const response = await api.delete(
			`/api/commission-imports/${commissionImportId}`,
		);
		return response.data;
	});

export const createCommissionImportQuery = createServerFn({ method: "POST" })
	.inputValidator((data) => {
		if (!(data instanceof FormData)) {
			throw new Error("Expected FormData");
		}
		return data;
	})
	.handler(async ({ data }) => {
		const response = await api.post(
			"/api/commission-imports/custom-create",
			data,
		);
		return response.data;
	});

export const updateCommissionSupplierQuery = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			id: string;
			production: number;
			encours: number;
			sheet_lines: Array<{
				rowIndex: number;
				subcode: string;
				amount: number;
				verificationKeyword: string;
				fullRow: any[];
			}>;
		}) => data,
	)
	.handler(async ({ data }) => {
		const response = await api.patch(
			`/api/commission-suppliers/${data.id}`,
			data,
		);
		return response.data;
	});
