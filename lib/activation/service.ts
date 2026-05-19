import { and, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { activationHistory, permittedInvoices } from "@/lib/db/schema";
import { normalizeDeviceCode, normalizeInvoice } from "./normalize";

export type ActivationResult =
  | { ok: true; invoiceNumber: string; deviceCode: string }
  | { ok: false; message: string; code: string };

const COUNTED_METHODS = ["online", "offline"] as const;

async function countSuccessfulActivations(
  invoice: string,
  device?: string,
): Promise<number> {
  const db = await getDb();
  const conditions = [
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

async function countDistinctDevices(invoice: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ count: sql<number>`count(distinct ${activationHistory.deviceCode})` })
    .from(activationHistory)
    .where(
      and(
        eq(activationHistory.invoiceNumber, invoice),
        eq(activationHistory.status, "success"),
        inArray(activationHistory.method, [...COUNTED_METHODS]),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

async function logActivation(
  invoice: string,
  device: string,
  method: "online" | "offline" | "offline_issue",
  status: "success" | "failed" | "issued",
  message?: string,
) {
  const db = await getDb();
  await db.insert(activationHistory).values({
    id: uuid(),
    invoiceNumber: invoice,
    deviceCode: device,
    method,
    status,
    message: message ?? null,
    createdAt: Date.now(),
  });
}

export async function checkActivationEligibility(
  invoiceRaw: string,
  deviceRaw: string,
): Promise<ActivationResult> {
  const invoice = normalizeInvoice(invoiceRaw);
  const device = normalizeDeviceCode(deviceRaw);

  if (!invoice) {
    return { ok: false, code: "INVALID_INPUT", message: "Nomor invoice wajib diisi." };
  }
  if (!device) {
    return { ok: false, code: "INVALID_INPUT", message: "Kode perangkat wajib diisi." };
  }

  const db = await getDb();
  const permitted = await db
    .select()
    .from(permittedInvoices)
    .where(eq(permittedInvoices.invoiceNumber, invoice))
    .limit(1);

  if (permitted.length === 0 || permitted[0]!.active !== 1) {
    return {
      ok: false,
      code: "INVOICE_NOT_PERMITTED",
      message: "Nomor invoice tidak terdaftar atau tidak aktif.",
    };
  }

  const rule = permitted[0]!;
  const perDeviceCount = await countSuccessfulActivations(invoice, device);
  if (perDeviceCount >= rule.maxActivationsPerDevice) {
    return {
      ok: false,
      code: "DEVICE_LIMIT",
      message:
        "Sudah melebihi batas aktivasi untuk kombinasi invoice dan kode perangkat yang sama.",
    };
  }

  const distinctDevices = await countDistinctDevices(invoice);
  const deviceAlreadyUsed = perDeviceCount > 0;
  if (!deviceAlreadyUsed && distinctDevices >= rule.maxDevices) {
    return {
      ok: false,
      code: "MACHINE_LIMIT",
      message:
        "Sudah melebihi batas aktivasi invoice pada perangkat yang berbeda.",
    };
  }

  return { ok: true, invoiceNumber: invoice, deviceCode: device };
}

export async function activateOnline(
  invoiceRaw: string,
  deviceRaw: string,
): Promise<ActivationResult> {
  const result = await checkActivationEligibility(invoiceRaw, deviceRaw);
  if (!result.ok) {
    const invoice = normalizeInvoice(invoiceRaw);
    const device = normalizeDeviceCode(deviceRaw);
    if (invoice && device) {
      await logActivation(invoice, device, "online", "failed", result.message);
    }
    return result;
  }

  await logActivation(result.invoiceNumber, result.deviceCode, "online", "success");
  return result;
}

export async function issueOfflineCodeRequest(
  invoiceRaw: string,
  deviceRaw: string,
): Promise<ActivationResult> {
  const result = await checkActivationEligibility(invoiceRaw, deviceRaw);
  if (!result.ok) {
    const invoice = normalizeInvoice(invoiceRaw);
    const device = normalizeDeviceCode(deviceRaw);
    if (invoice && device) {
      await logActivation(invoice, device, "offline_issue", "failed", result.message);
    }
    return result;
  }

  await logActivation(
    result.invoiceNumber,
    result.deviceCode,
    "offline_issue",
    "issued",
    "Kode offline diterbitkan",
  );
  return result;
}

export async function confirmOfflineActivation(
  invoiceRaw: string,
  deviceRaw: string,
): Promise<ActivationResult> {
  const result = await checkActivationEligibility(invoiceRaw, deviceRaw);
  if (!result.ok) return result;
  await logActivation(result.invoiceNumber, result.deviceCode, "offline", "success");
  return result;
}
