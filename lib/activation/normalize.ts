export function normalizeInvoice(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeDeviceCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
