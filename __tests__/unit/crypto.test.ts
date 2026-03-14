import { describe, it, expect } from "vitest";
import { encrypt, decrypt, maskSecret, encryptNullable, decryptNullable } from "@/lib/crypto";

describe("crypto", () => {
  it("encrypts and decrypts a string correctly", () => {
    const plaintext = "sk-ant-api03-my-super-secret-key";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "same-value";
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
    expect(decrypt(c1)).toBe(plaintext);
    expect(decrypt(c2)).toBe(plaintext);
  });

  it("throws on tampered ciphertext", () => {
    const ciphertext = encrypt("sensitive");
    const parts = ciphertext.split(":");
    parts[2] = "deadbeef".repeat(4);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("throws on invalid format", () => {
    expect(() => decrypt("not-valid-format")).toThrow("Invalid encrypted value format");
  });

  it("masks short secrets", () => {
    expect(maskSecret("abc")).toBe("****");
  });

  it("masks long secrets correctly", () => {
    const masked = maskSecret("sk-ant-api03-abcdefghijklmnop");
    expect(masked).toMatch(/^sk-ant\.\.\./);
    expect(masked).toContain("...");
    expect(masked).not.toContain("api03");
  });

  it("encryptNullable returns null for null/undefined", () => {
    expect(encryptNullable(null)).toBeNull();
    expect(encryptNullable(undefined)).toBeNull();
    expect(encryptNullable("")).toBeNull();
  });

  it("decryptNullable returns null for null/undefined", () => {
    expect(decryptNullable(null)).toBeNull();
    expect(decryptNullable(undefined)).toBeNull();
  });

  it("round-trips through encryptNullable/decryptNullable", () => {
    const original = "my-api-key";
    const encrypted = encryptNullable(original);
    expect(decryptNullable(encrypted)).toBe(original);
  });
});
