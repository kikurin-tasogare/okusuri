import { requireAdminAuth } from "../lib/auth.js";
import { pushLineTest } from "../lib/line.js";
import { ensureResponseHelpers, readRawBody, type VercelRequest, type VercelResponse } from "../lib/vercel.js";

type TestLinePushPayload = {
  lineUserId?: string;
};

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

  if (req.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = JSON.parse(await readRawBody(req)) as TestLinePushPayload;
  if (!body.lineUserId) {
    response.status(400).json({ error: "Missing lineUserId" });
    return;
  }

  await pushLineTest(body.lineUserId);
  response.status(200).json({ ok: true });
}
