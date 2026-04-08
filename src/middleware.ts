import { createMiddleware } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import crypto from "crypto";
import { Pool } from "pg";

const PAYLOAD_API_URL = "https://simply-life-admin.fr";

function signToken(token: string, secret: string): string {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(token)
    .digest("base64");
  return `${token}.${signature}`;
}

export const bridgeAuthMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const url = new URL(request.url);
    const bridgeToken = url.searchParams.get("bridge_token");

    if (!bridgeToken) return next();

    const existingSession =
      getCookie("__Secure-better-auth.session_token") ||
      getCookie("better-auth.session_token");
    if (existingSession) return next();

    const res = await fetch(
      `${PAYLOAD_API_URL}/api/auth-bridge-tokens/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: bridgeToken }),
      },
    );

    if (!res.ok) return next();

    const admin = await res.json();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
      const userResult = await pool.query(
        'SELECT id FROM "user" WHERE email = $1 LIMIT 1',
        [admin.email],
      );
      const user = userResult.rows[0];
      if (!user) return next();

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 60 * 1000);
      const now = new Date();

      await pool.query(
        'INSERT INTO "session" (id, "userId", "expiresAt", token, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6)',
        [crypto.randomUUID(), user.id, expiresAt, sessionToken, now, now],
      );

      const signedToken = signToken(sessionToken, process.env.BETTER_AUTH_SECRET!);

      const cookieName = process.env.NODE_ENV === "production"
        ? "__Secure-better-auth.session_token"
        : "better-auth.session_token";

      setCookie(cookieName, signedToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 60,
      });

      // Pass userId via context so beforeLoad can skip session check
      return next({ context: { bridgeUserId: user.id } });
    } finally {
      await pool.end();
    }
  },
);
