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

    console.log(
      "[bridge] URL:",
      url.pathname,
      "| token:",
      bridgeToken ?? "none",
    );

    if (!bridgeToken) return next();

    const existingSession = getCookie("better-auth.session_token");
    console.log("[bridge] existing session:", existingSession ?? "none");
    if (existingSession) return next();

    console.log("[bridge] validating token against Payload...");
    const res = await fetch(
      `${PAYLOAD_API_URL}/api/auth-bridge-tokens/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: bridgeToken }),
      },
    );

    console.log("[bridge] Payload response status:", res.status);
    if (!res.ok) {
      console.log("[bridge] validation failed, skipping");
      return next();
    }

    const admin = await res.json();
    console.log("[bridge] admin found:", admin.email);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
      const userResult = await pool.query(
        'SELECT id FROM "user" WHERE email = $1 LIMIT 1',
        [admin.email],
      );
      const user = userResult.rows[0];
      console.log("[bridge] better-auth user:", user?.id ?? "NOT FOUND");
      if (!user) return next();

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 60 * 1000);
      const now = new Date();

      await pool.query(
        'INSERT INTO "session" (id, "userId", "expiresAt", token, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6)',
        [crypto.randomUUID(), user.id, expiresAt, sessionToken, now, now],
      );
      console.log("[bridge] session created, token:", sessionToken);

      const signedToken = signToken(
        sessionToken,
        process.env.BETTER_AUTH_SECRET!,
      );

      setCookie("better-auth.session_token", signedToken, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 60,
      });
      console.log("[bridge] signed cookie set");
    } catch (err) {
      console.error("[bridge] error:", err);
    } finally {
      await pool.end();
      console.log("[bridge] pool closed");
    }

    return next();
  },
);
