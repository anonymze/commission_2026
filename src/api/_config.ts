import axios from "redaxios";

export const api = axios.create({
	baseURL: process.env.API_URL,
	headers: {
		Authorization: `admins API-Key ${process.env.API_ADMIN_KEY}`,
	},
});

export function handleApiError(error: any): never {
	const cleanError = new Error(
		error.data?.errors?.[0]?.message || error.statusText || "Request failed",
	);
	Object.assign(cleanError, {
		status: error.status,
		statusText: error.statusText,
		data: error.data,
	});
	throw cleanError;
}
