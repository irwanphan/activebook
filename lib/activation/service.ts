import { and, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import {
  activationHistory,
  permittedInvoiceProducts,
  permittedInvoices,
} from "@/lib/db/schema";
import { normalizeProductId, type ProductId } from "@/lib/products";
import { normalizeDeviceCode, normalizeInvoice } from "./normalize";

export type ActivationResult =
  | { ok: true; invoiceNumber: string; deviceCode: string; productId: ProductId }
  | { ok: false; message: string; code: string };

const COUNTED_METHODS = ["online", "offline"] as const;

type ProductRule = {
  invoiceId: string;
  productId: ProductId;
  maxActivationsPerDevice: number;
  maxDevices: number;
  invoiceActive: boolean;
};

async function getProductRule(
  invoice: string,
  productId: ProductId,
): Promise<ProductRule | null> {
  const db = await getDb();
  const rows = await db
    .select({
      invoiceId: permittedInvoices.id,
      productId: permittedInvoiceProducts.productId,
      maxActivationsPerDevice: permittedInvoiceProducts.maxActivationsPerDevice,
      maxDevices: permittedInvoiceProducts.maxDevices,
      invoiceActive: permittedInvoices.active,
    })
    .from(permittedInvoices)
    .innerJoin(
      permittedInvoiceProducts,
      eq(permittedInvoiceProducts.invoiceId, permittedInvoices.id),
    )
    .where(
      and(
        eq(permittedInvoices.invoiceNumber, invoice),
        eq(permittedInvoiceProducts.productId, productId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0]!;
  return {
    invoiceId: row.invoiceId,
    productId: row.productId as ProductId,
    maxActivationsPerDevice: row.maxActivationsPerDevice,
    maxDevices: row.maxDevices,
    invoiceActive: row.invoiceActive === 1,
  };
}

async function countSuccessfulActivations(
  productId: ProductId,
  invoice: string,
  device?: string,
): Promise<number> {
  const db = await getDb();
  const conditions = [
    eq(activationHistory.productId, productId),
    eq(activationHistory.invoiceNumber, invoice),
    eq(activationHistory.status, "success"),
    inArray(activationHistory.method, [...COUNTED_METHODS]),
  ];
  if (device) {
    conditions.push(eq(activationHistory.deviceCode, device));
  }
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(activationHistory)
    .where(and(...conditions));
  return Number(rows[0]?.count ?? 0);
}

async function countDistinctDevices(productId: ProductId, invoice: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ count: sql<number>`count(distinct ${activationHistory.deviceCode})` })
    .from(activationHistory)
    .where(
      and(
        eq(activationHistory.productId, productId),
        eq(activationHistory.invoiceNumber, invoice),
        eq(activationHistory.status, "success"),
        inArray(activationHistory.method, [...COUNTED_METHODS]),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

async function logActivation(
  productId: ProductId,
  invoice: string,
  device: string,
  method: "online" | "offline" | "offline_issue",
  status: "success" | "failed" | "issued",
  message?: string,
) {
  const db = await getDb();
  await db.insert(activationHistory).values({
    id: uuid(),
    productId,
    invoiceNumber: invoice,
    deviceCode: device,
    method,
    status,
    message: message ?? null,
    createdAt: Date.now(),
  });
}

export async function checkActivationEligibility(
  productIdRaw: string,
  invoiceRaw: string,
  deviceRaw: string,
): Promise<ActivationResult> {
  const productId = normalizeProductId(productIdRaw);
  if (!productId) {
    return { ok: false, code: "INVALID_PRODUCT", message: "Produk aplikasi tidak valid." };
  }

  const invoice = normalizeInvoice(invoiceRaw);
  const device = normalizeDeviceCode(deviceRaw);

  if (!invoice) {
    return { ok: false, code: "INVALID_INPUT", message: "Nomor invoice wajib diisi." };
  }
  if (!device) {
    return { ok: false, code: "INVALID_INPUT", message: "Kode perangkat wajib diisi." };
  }

  const rule = await getProductRule(invoice, productId);
  if (!rule || !rule.invoiceActive) {
    return {
      ok: false,
      code: "INVOICE_NOT_PERMITTED",
      message: `Invoice tidak terdaftar atau tidak aktif untuk ${productId}.`,
    };
  }

  const perDeviceCount = await countSuccessfulActivations(productId, invoice, device);
  if (perDeviceCount >= rule.maxActivationsPerDevice) {
    return {
      ok: false,
      code: "DEVICE_LIMIT",
      message:
        "Sudah melebihi batas aktivasi untuk kombinasi invoice, produk, dan kode perangkat yang sama.",
    };
  }

  const distinctDevices = await countDistinctDevices(productId, invoice);
  const deviceAlreadyUsed = perDeviceCount > 0;
  if (!deviceAlreadyUsed && distinctDevices >= rule.maxDevices) {
    return {
      ok: false,
      code: "MACHINE_LIMIT",
      message: "Sudah melebihi batas aktivasi invoice pada perangkat yang berbeda untuk produk ini.",
    };
  }

  return { ok: true, invoiceNumber: invoice, deviceCode: device, productId };
}

export async function activateOnline(
  productIdRaw: string,
  invoiceRaw: string,
  deviceRaw: string,
): Promise<ActivationResult> {
  const productId = normalizeProductId(productIdRaw);
  const result = await checkActivationEligibility(productIdRaw, invoiceRaw, deviceRaw);
  if (!result.ok) {
    const invoice = normalizeInvoice(invoiceRaw);
    const device = normalizeDeviceCode(deviceRaw);
    if (productId && invoice && device) {
      await logActivation(productId, invoice, device, "online", "failed", result.message);
    }
    return result;
  }

  await logActivation(
    result.productId,
    result.invoiceNumber,
    result.deviceCode,
    "online",
    "success",
  );
  return result;
}

export async function issueOfflineCodeRequest(
  productIdRaw: string,
  invoiceRaw: string,
  deviceRaw: string,
): Promise<ActivationResult> {
  const productId = normalizeProductId(productIdRaw);
  const result = await checkActivationEligibility(productIdRaw, invoiceRaw, deviceRaw);
  if (!result.ok) {
    const invoice = normalizeInvoice(invoiceRaw);
    const device = normalizeDeviceCode(deviceRaw);
    if (productId && invoice && device) {
      await logActivation(productId, invoice, device, "offline_issue", "failed", result.message);
    }
    return result;
  }

  await logActivation(
    result.productId,
    result.invoiceNumber,
    result.deviceCode,
    "offline_issue",
    "issued",
    "Kode offline diterbitkan",
  );
  return result;
}

export async function confirmOfflineActivation(
  productIdRaw: string,
  invoiceRaw: string,
  deviceRaw: string,
): Promise<ActivationResult> {
  const result = await checkActivationEligibility(productIdRaw, invoiceRaw, deviceRaw);
  if (!result.ok) return result;
  await logActivation(
    result.productId,
    result.invoiceNumber,
    result.deviceCode,
    "offline",
    "success",
  );
  return result;
}
