import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type SellerDashboardMonthly = {
  month: string;
  revenueMinor: number;
  profitMinor: number | null;
  lossMinor: number | null;
};

export type SellerDashboardTopProduct = {
  name: string;
  unitsSold: number;
  revenueMinor: number;
};

export type SellerDashboard = {
  periodLabel: string;
  metricsDefinition: string;
  revenueMonthMinor: number;
  profitMonthMinor: number | null;
  lossMonthMinor: number | null;
  ordersMonth: number;
  avgOrderValueMinor: number;
  openOrders: number;
  lowStockSkus: number;
  repeatCustomerPercent: number;
  newCustomersMonth: number;
  returningCustomersMonth: number;
  monthly: SellerDashboardMonthly[];
  topProducts: SellerDashboardTopProduct[];
};

function errWithStatus(message: string, status: number): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

export async function fetchSellerDashboard(
  ownerUserId: string,
  shopId: string,
): Promise<SellerDashboard> {
  const res = await fetch(
    `${getApiBase()}/users/${ownerUserId}/shops/${shopId}/dashboard`,
  );
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as SellerDashboard;
}
