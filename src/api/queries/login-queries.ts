import { createServerFn } from "@tanstack/react-start";
import type { AppUser } from "@/types/user";
import { api } from "../_config";

export const loginQuery = createServerFn({ method: "POST" })
	.inputValidator((data: { email: string; password: string }) => data)
	.handler(async ({ data: { email, password } }) => {
		const response = await api.post<AppUser>("/api/admins/login", {
			email,
			password,
		});
		return response.data;
	});
