import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const hexKey = process.env.FIELD_ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== 64) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hexKey, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypts a value previously encrypted with encrypt().
 * Throws if the ciphertext has been tampered with (authTag mismatch).
 */
export function decrypt(encryptedValue: string): string {
  const key = getKey();
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Returns a masked version of a secret for display in the UI.
 * e.g. "sk-ant-api03-very-long-key..." → "sk-ant-...long-key..."
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return "****";
  const prefix = secret.slice(0, 6);
  const suffix = secret.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Safely encrypts a value, returning null if the value is null/undefined.
 */
export function encryptNullable(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

/**
 * Safely decrypts a value, returning null if the value is null/undefined.
 */
export function decryptNullable(value: string | null | undefined): string | null {
  if (!value) return null;
  return decrypt(value);
}
