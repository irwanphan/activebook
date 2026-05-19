import * as ed from "@noble/ed25519";
import { normalizeProductId, type ProductId } from "@/lib/products";
import { normalizeDeviceCode, normalizeInvoice } from "./normalize";

export type OfflinePayloadV1 = {
  inv: string;
  dev: string;
  iat: number;
  v: 1;
};

export type OfflinePayloadV2 = {
  inv: string;
  dev: string;
  app: string;
  iat: number;
  v: 2;
};

export type OfflinePayload = OfflinePayloadV1 | OfflinePayloadV2;

function getPrivateKeyBytes(): Uint8Array {
  const raw = process.env.ACTIVATION_PRIVATE_KEY;
  if (!raw) {
    throw new Error("ACTIVATION_PRIVATE_KEY belum dikonfigurasi.");
  }
  return Uint8Array.from(Buffer.from(raw, "base64"));
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
  productId: string,
  invoiceNumber: string,
  deviceCode: string,
): Promise<string> {
  const app = normalizeProductId(productId);
  if (!app) {
    throw new Error("Produk tidak valid.");
  }
  const payload: OfflinePayloadV2 = {
    inv: normalizeInvoice(invoiceNumber),
    dev: normalizeDeviceCode(deviceCode),
    app,
    iat: Math.floor(Date.now() / 1000),
    v: 2,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const privateKey = getPrivateKeyBytes();
  const signature = await ed.signAsync(payloadBytes, privateKey);
  return `EB1.${encodeBase64Url(payloadBytes)}.${encodeBase64Url(signature)}`;
}

export async function verifyOfflineActivationCode(
  code: string,
  expectedProductId: string,
  expectedInvoice: string,
  expectedDevice: string,
  publicKeyBase64: string,
): Promise<{ ok: true; payload: OfflinePayload; productId: ProductId } | { ok: false; message: string }> {
  const trimmed = code.trim();
  if (!trimmed.startsWith("EB1.")) {
    return { ok: false, message: "Format kode aktivasi tidak valid." };
  }
  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return { ok: false, message: "Format kode aktivasi tidak valid." };
  }

  const expectedApp = normalizeProductId(expectedProductId);
  if (!expectedApp) {
    return { ok: false, message: "Produk aplikasi tidak valid." };
  }

  try {
    const payloadBytes = decodeBase64Url(parts[1]!);
    const signature = decodeBase64Url(parts[2]!);
    const publicKey = Uint8Array.from(Buffer.from(publicKeyBase64, "base64"));
    const valid = await ed.verifyAsync(signature, payloadBytes, publicKey);
    if (!valid) {
      return { ok: false, message: "Tanda tangan kode aktivasi tidak valid." };
    }

    const raw = JSON.parse(new TextDecoder().decode(payloadBytes)) as OfflinePayload;
    const inv = normalizeInvoice(expectedInvoice);
    const dev = normalizeDeviceCode(expectedDevice);

    if (raw.inv !== inv) {
      return { ok: false, message: "Kode aktivasi tidak cocok dengan nomor invoice." };
    }
    if (raw.dev !== dev) {
      return { ok: false, message: "Kode aktivasi tidak cocok dengan kode perangkat." };
    }

    if (raw.v === 2) {
      if (raw.app !== expectedApp) {
        return { ok: false, message: "Kode aktivasi tidak untuk aplikasi ini." };
      }
      return { ok: true, payload: raw, productId: expectedApp };
    }

    if (raw.v === 1) {
      // Legacy: hanya untuk ERP
      if (expectedApp !== "easybook-erp") {
        return {
          ok: false,
          message: "Kode aktivasi lama hanya berlaku untuk EasyBook ERP.",
        };
      }
      return { ok: true, payload: raw, productId: "easybook-erp" };
    }

    return { ok: false, message: "Versi kode aktivasi tidak didukung." };
  } catch {
    return { ok: false, message: "Kode aktivasi tidak dapat dibaca." };
  }
}
