import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createAuthClient } from "better-auth/react";
import { auth } from "./auth";

export const authClient = createAuthClient({
	baseURL: import.meta.env.BETTER_AUTH_URL || "http://localhost:3000",
});

export const loginLogic = async ({
	email,
	password,
	queryClient,
}: {
	email: string;
	password: string;
	queryClient: QueryClient;
}) => {
	const result = await signIn.email({
		email: email,
		password: password,
		rememberMe: true,
	});

	if (result.error) return result;

	queryClient.setQueryData(sessionQueryOptions().queryKey, {
		userId: result.data.user.id,
	});

	return result;
};

export const logoutLogic = async ({
	queryClient,
}: {
	queryClient: QueryClient;
}) => {
	queryClient.removeQueries({
		queryKey: sessionQueryOptions().queryKey,
	});
	return signOut();
};

const fetchUserSession = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({
		headers,
	});

	return {
		userId: session?.session.userId,
	};
});

export const sessionQueryOptions = () =>
	queryOptions({
		queryKey: ["session"],
		queryFn: fetchUserSession,
		staleTime: 1000 * 60 * 60, // 60 mins
	});

export const { signUp, useSession, signIn, signOut } = authClient;
