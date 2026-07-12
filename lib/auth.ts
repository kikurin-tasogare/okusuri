import crypto from "node:crypto";
import { getAppEnv } from "./env.js";

function unauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="okusuri-admin", charset="UTF-8"'
    }
  });
}

export function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAdminAuth(request: Request): Response | null {
  const appEnv = getAppEnv();

  if (!appEnv.adminUsername || !appEnv.adminPassword) {
    return null;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return unauthorizedResponse();
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (!safeEqualText(username, appEnv.adminUsername) || !safeEqualText(password, appEnv.adminPassword)) {
    return unauthorizedResponse();
  }

  return null;
}
