import crypto from "node:crypto";
import { getAppEnv, getLineEnv } from "./env.js";

const encryptedPrefix = "enc:v1:";

function deriveKey(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

// New encryptions use ENCRYPTION_SECRET when set, so titles stay decryptable even
// if the LINE channel secret is rotated. Without it, the legacy LINE-derived key
// is used for both directions, exactly as before.
function encryptionKey() {
  const { encryptionSecret } = getAppEnv();
  return deriveKey(encryptionSecret || getLineEnv().lineChannelSecret);
}

function decryptionKeys() {
  const keys = [encryptionKey()];
  if (getAppEnv().encryptionSecret) {
    // Rows written before ENCRYPTION_SECRET existed still use the legacy key.
    keys.push(deriveKey(getLineEnv().lineChannelSecret));
  }
  return keys;
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
  let lastError: unknown;

  for (const key of decryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
