import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type CreateDeliveryRadiusRuleBody = {
  minOrderAmount: number;
  maxServiceRadiusKm: number;
};

export type ShopDeliveryRadiusRule = {
  id: string;
  shopId: string;
  minOrderAmount: string;
  maxServiceRadiusKm: number;
};

export async function fetchDeliveryRadiusRules(shopId: string): Promise<ShopDeliveryRadiusRule[]> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}/delivery-radius-rules`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopDeliveryRadiusRule[];
}

export async function createDeliveryRadiusRule(
  shopId: string,
  body: CreateDeliveryRadiusRuleBody,
): Promise<ShopDeliveryRadiusRule> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}/delivery-radius-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopDeliveryRadiusRule;
}

export async function updateDeliveryRadiusRule(
  ruleId: string,
  body: CreateDeliveryRadiusRuleBody,
): Promise<ShopDeliveryRadiusRule> {
  const res = await fetch(`${getApiBase()}/delivery-radius-rules/${ruleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopDeliveryRadiusRule;
}

export async function deleteDeliveryRadiusRule(ruleId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/delivery-radius-rules/${ruleId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
}
