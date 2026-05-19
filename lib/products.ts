export const PRODUCTS = [
  { id: "easybook-erp", code: "easybook-erp", name: "EasyBook ERP" },
  { id: "easybook-crm", code: "easybook-crm", name: "EasyBook CRM" },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

const PRODUCT_IDS = new Set<string>(PRODUCTS.map((p) => p.id));

export function isValidProductId(value: string): value is ProductId {
  return PRODUCT_IDS.has(value);
}

export function normalizeProductId(value: string): ProductId | null {
  const id = value.trim().toLowerCase();
  return isValidProductId(id) ? id : null;
}

export function getProductName(productId: string): string {
  return PRODUCTS.find((p) => p.id === productId)?.name ?? productId;
}
