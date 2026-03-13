import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { PaginatedResponse } from "@/types/response";
import type { User } from "@/types/user";
import { api } from "../_config";

export const getAppUsersQuery = createServerFn({ method: "POST" }).handler(
	async () => {
		const response = await api.get<PaginatedResponse<User>>("/api/app-users", {
			params: {
				limit: 100,
				sort: "lastname",
				pagination: false,
			},
		});
		return response.data;
	},
);

export const appUsersQueryOptions = () =>
	queryOptions({
		queryKey: ["users"],
		queryFn: getAppUsersQuery,
	});
