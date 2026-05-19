import * as ed from "@noble/ed25519";
import { normalizeDeviceCode, normalizeInvoice } from "./normalize";

export type OfflinePayload = {
  inv: string;
  dev: string;
  iat: number;
  v: 1;
};

function getPrivateKeyBytes(): Uint8Array {
  const raw = process.env.ACTIVATION_PRIVATE_KEY;
  if (!raw) {
    throw new Error("ACTIVATION_PRIVATE_KEY belum dikonfigurasi.");
  }
  return Uint8Array.from(Buffer.from(raw, "base64"));
}

export function getPublicKeyBase64(): string {
  const fromEnv = process.env.ACTIVATION_PUBLIC_KEY;
  if (fromEnv) return fromEnv;
  throw new Error("ACTIVATION_PUBLIC_KEY belum dikonfigurasi.");
}

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

export async function signOfflineActivationCode(
  invoiceNumber: string,
  deviceCode: string,
): Promise<string> {
  const payload: OfflinePayload = {
    inv: normalizeInvoice(invoiceNumber),
    dev: normalizeDeviceCode(deviceCode),
    iat: Math.floor(Date.now() / 1000),
    v: 1,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const privateKey = getPrivateKeyBytes();
  const signature = await ed.signAsync(payloadBytes, privateKey);
  return `EB1.${encodeBase64Url(payloadBytes)}.${encodeBase64Url(signature)}`;
}

export async function verifyOfflineActivationCode(
  code: string,
  expectedInvoice: string,
  expectedDevice: string,
  publicKeyBase64: string,
): Promise<{ ok: true; payload: OfflinePayload } | { ok: false; message: string }> {
  const trimmed = code.trim();
  if (!trimmed.startsWith("EB1.")) {
    return { ok: false, message: "Format kode aktivasi tidak valid." };
  }
  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return { ok: false, message: "Format kode aktivasi tidak valid." };
  }
  try {
    const payloadBytes = decodeBase64Url(parts[1]!);
    const signature = decodeBase64Url(parts[2]!);
    const publicKey = Uint8Array.from(Buffer.from(publicKeyBase64, "base64"));
    const valid = await ed.verifyAsync(signature, payloadBytes, publicKey);
    if (!valid) {
      return { ok: false, message: "Tanda tangan kode aktivasi tidak valid." };
    }
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as OfflinePayload;
    if (payload.v !== 1) {
      return { ok: false, message: "Versi kode aktivasi tidak didukung." };
    }
    const inv = normalizeInvoice(expectedInvoice);
    const dev = normalizeDeviceCode(expectedDevice);
    if (payload.inv !== inv) {
      return { ok: false, message: "Kode aktivasi tidak cocok dengan nomor invoice." };
    }
    if (payload.dev !== dev) {
      return { ok: false, message: "Kode aktivasi tidak cocok dengan kode perangkat." };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, message: "Kode aktivasi tidak dapat dibaca." };
  }
}
