import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[]>;
};

export type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  send: (body: string) => void;
  setHeader: (name: string, value: string | readonly string[]) => VercelResponse;
};

export function ensureResponseHelpers(res: ServerResponse): VercelResponse {
  const typed = res as VercelResponse;

  typed.status = (code: number) => {
    typed.statusCode = code;
    return typed;
  };

  typed.json = (body: unknown) => {
    if (!typed.getHeader("content-type")) {
      typed.setHeader("content-type", "application/json; charset=utf-8");
    }
    typed.end(JSON.stringify(body));
  };

  typed.send = (body: string) => {
    typed.end(body);
  };

  return typed;
}

export async function readRawBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
