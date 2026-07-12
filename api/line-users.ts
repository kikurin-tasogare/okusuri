import { requireAdminAuth } from "../lib/auth.js";
import { listLineUsers } from "../lib/reminders.js";
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

  const lineUsers = await listLineUsers();
  response.status(200).json({
    lineUsers: lineUsers.map((lineUser) => ({
      line_user_id: `${lineUser.line_user_id.slice(0, 8)}...`,
      linked_at: lineUser.linked_at
    }))
  });
}
