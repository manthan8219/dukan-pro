import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type CatalogProductRecord = {
  id: string;
  name: string;
  nameNormalized: string;
  description: string | null;
  category: string | null;
  defaultImageUrl: string | null;
  searchTerms: string[] | null;
};

export function normalizeProductName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function errWithStatus(message: string, status: number): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

export async function searchCatalogProducts(
  q: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<CatalogProductRecord[]> {
  const params = new URLSearchParams({
    q: q.trim(),
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });
  const res = await fetch(`${getApiBase()}/products/search?${params}`, { signal });
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as CatalogProductRecord[];
}

export type CreateCatalogProductPayload = {
  name: string;
  description?: string | null;
  category?: string | null;
  defaultImageUrl?: string | null;
  searchTerms?: string[] | null;
};

export async function createCatalogProduct(
  payload: CreateCatalogProductPayload,
): Promise<CatalogProductRecord> {
  const res = await fetch(`${getApiBase()}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? undefined,
      category: payload.category ?? undefined,
      defaultImageUrl: payload.defaultImageUrl ?? undefined,
      searchTerms: payload.searchTerms ?? undefined,
    }),
  });
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as CatalogProductRecord;
}
