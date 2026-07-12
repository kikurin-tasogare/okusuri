import { requireAdminAuth } from "../lib/auth.js";
import { getEnvStatus } from "../lib/env.js";
import { ensureResponseHelpers, type VercelRequest, type VercelResponse } from "../lib/vercel.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const response = ensureResponseHelpers(res);
  const origin = req.headers.host ? `http://${req.headers.host}` : "http://localhost";
  const request = new Request(`${origin}${req.url ?? "/"}`, {
    method: req.method,
    headers: req.headers as HeadersInit
  });
  const authError = requireAdminAuth(request);
  if (authError) {
    response.status(authError.status);
    for (const [key, value] of authError.headers.entries()) {
      response.setHeader(key, value);
    }
    response.send(await authError.text());
    return;
  }

  if (req.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const env = getEnvStatus();
  let supabaseConnection: "ready" | "missing-env" | "error" = "missing-env";

  if (env.supabaseUrl && env.supabaseServiceRoleKey) {
    try {
      const { listLineUsers } = await import("../lib/reminders.js");
      await listLineUsers();
      supabaseConnection = "ready";
    } catch (error) {
      console.error("Supabase setup status check failed", error);
      supabaseConnection = "error";
    }
  }

  response.status(200).json({
    env,
    supabaseConnection
  });
}
