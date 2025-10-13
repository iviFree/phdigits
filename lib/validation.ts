import { z } from "zod";

export const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(254)
  .email();

export const passwordSchema = z.string()
  .min(8)
  .max(128);

export const normalizeCode = (raw: string) => {
  const s = (raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return s.replace(/[^A-Z0-9]/g, "");
};

export const codeRegex =
  /^(?:[A-Z]\d{3}|\d[A-Z]\d{2}|\d{2}[A-Z]\d|\d{3}[A-Z])$/;

export const codeSchema = z.string()
  .length(4)
  .refine((val) => codeRegex.test(val), {
    message: "Código inválido (3 dígitos y 1 letra mayúscula).",
  });

export class LocalRateLimiter {
  private capacity: number;
  private refillMs: number;
  private key: string;
  constructor(key: string, capacity = 20, refillMs = 60_000) {
    this.key = `rate:${key}`;
    this.capacity = capacity;
    this.refillMs = refillMs;
    this.ensure();
  }
  private ensure() {
    const now = Date.now();
    const raw = sessionStorage.getItem(this.key);
    if (!raw) {
      sessionStorage.setItem(this.key, JSON.stringify({ tokens: this.capacity, ts: now }));
      return;
    }
    const obj = JSON.parse(raw);
    const elapsed = now - obj.ts;
    const tokensToAdd = Math.floor(elapsed / this.refillMs) * this.capacity;
    const tokens = Math.min(this.capacity, obj.tokens + tokensToAdd);
    sessionStorage.setItem(this.key, JSON.stringify({ tokens, ts: tokensToAdd ? now : obj.ts }));
  }
  tryConsume(count = 1) {
    const raw = sessionStorage.getItem(this.key)!;
    const obj = JSON.parse(raw);
    if (obj.tokens >= count) {
      obj.tokens -= count;
      sessionStorage.setItem(this.key, JSON.stringify(obj));
      return true;
    }
    return false;
  }
}
