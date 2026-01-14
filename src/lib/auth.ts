import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";

export const auth = betterAuth({
	database: new Pool({
		connectionString: process.env.DATABASE_URL,
	}),
	emailAndPassword: {
		enabled: true,
	},
	session: {
		disableSessionRefresh: false,
		expiresIn: 60 * 60 * 24 * 60, // 60 days
	},
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
	plugins: [tanstackStartCookies()],
});
