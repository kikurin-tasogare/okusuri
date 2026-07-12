import { listReminderAdminSummaries } from "../lib/reminders.js";
import { requireAdminAuth } from "../lib/auth.js";
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

  if (req.method === "GET") {
    const reminders = await listReminderAdminSummaries();
    response.status(200).json({
      reminders: reminders.map((reminder) => ({
        id: reminder.id,
        enabled: reminder.enabled,
        category: reminder.category,
        owner: reminder.line_user_id ? `${reminder.line_user_id.slice(0, 8)}...` : "unknown",
        createdAt: reminder.created_at
      }))
    });
    return;
  }

  if (req.method === "POST") {
    response.status(403).json({ error: "Reminder registration is only available from LINE." });
    return;
  }

  if (req.method === "DELETE") {
    response.status(403).json({ error: "Reminder deletion is only available from LINE." });
    return;
  }

  response.status(405).json({ error: "Method not allowed" });
}
