import crypto from "node:crypto";
import { getLineEnv } from "./env.js";

const encryptedPrefix = "enc:v1:";

function encryptionKey() {
  return crypto.createHash("sha256").update(getLineEnv().lineChannelSecret).digest();
}

export function encryptPrivateText(text: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${encryptedPrefix}${Buffer.concat([iv, authTag, encrypted]).toString("base64url")}`;
}

export function decryptPrivateText(text: string) {
  if (!text.startsWith(encryptedPrefix)) {
    return text;
  }

  const payload = Buffer.from(text.slice(encryptedPrefix.length), "base64url");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
