import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type ShopProductListing = {
  id: string;
  shopId: string;
  productId: string;
  quantity: number;
  imageContentId: string | null;
  unit: string;
  /** Selling price in minor units (e.g. paise). Shop-specific; no catalog default. */
  priceMinor: number;
  minOrderQuantity: number;
  isListed: boolean;
  listingNotes: string | null;
  displayImageUrl: string;
  productName: string;
  productCategory: string | null;
};

function errWithStatus(message: string, status: number): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

export async function listShopProducts(
  shopId: string,
  signal?: AbortSignal,
  listedOnly?: boolean,
): Promise<ShopProductListing[]> {
  const q =
    listedOnly === true ? '?listedOnly=true' : listedOnly === false ? '?listedOnly=false' : '';
  const res = await fetch(`${getApiBase()}/shops/${shopId}/products${q}`, { signal });
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as ShopProductListing[];
}

export type CreateShopProductPayload = {
  productId: string;
  quantity: number;
  /** Required: your price in minor units (e.g. paise). */
  priceMinor: number;
  imageContentId?: string | null;
  unit?: string;
  minOrderQuantity?: number;
  isListed?: boolean;
  listingNotes?: string | null;
};

export async function createShopProduct(
  shopId: string,
  payload: CreateShopProductPayload,
): Promise<ShopProductListing> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as ShopProductListing;
}

export type UpdateShopProductPayload = {
  quantity?: number;
  imageContentId?: string | null;
  unit?: string;
  priceMinor?: number;
  minOrderQuantity?: number;
  isListed?: boolean;
  listingNotes?: string | null;
};

export async function updateShopProduct(
  shopId: string,
  productId: string,
  payload: UpdateShopProductPayload,
): Promise<ShopProductListing> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as ShopProductListing;
}

export async function deleteShopProduct(shopId: string, productId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}/products/${productId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
}

export type ShopCsvImportResult = {
  created: number;
  updated: number;
  skippedParse: number;
  parseWarnings?: { rowNumber: number; message: string }[];
  errors?: string[];
  listings?: ShopProductListing[];
};

/** Multipart UTF-8 CSV — same columns as seller CSV preview; server creates catalog + listings. */
export async function importShopProductsCsv(
  shopId: string,
  file: File,
  signal?: AbortSignal,
): Promise<ShopCsvImportResult> {
  const body = new FormData();
  body.append('file', file, file.name);
  const res = await fetch(`${getApiBase()}/shops/${shopId}/products/import-csv`, {
    method: 'POST',
    body,
    signal,
  });
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as ShopCsvImportResult;
}
