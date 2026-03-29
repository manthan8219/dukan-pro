/**
 * Placeholder metrics for the seller dashboard UI.
 * Replace with API response mapping when the backend is ready.
 */
export type MonthlyMetric = {
  /** Short label, e.g. "Oct" */
  month: string;
  revenue: number;
  profit: number;
  /** Operational loss (returns, wastage, etc.) — positive number */
  loss: number;
};

export type TopProductRow = {
  name: string;
  unitsSold: number;
  revenue: number;
};

export type SellerDashboardMock = {
  /** Shown next to KPIs, e.g. "March 2026" */
  periodLabel: string;
  revenueMonth: number;
  profitMonth: number;
  lossMonth: number;
  ordersMonth: number;
  avgOrderValue: number;
  openOrders: number;
  lowStockSkus: number;
  repeatCustomerPercent: number;
  newCustomersMonth: number;
  returningCustomersMonth: number;
  monthly: MonthlyMetric[];
  topProducts: TopProductRow[];
};

export const SELLER_DASHBOARD_MOCK: SellerDashboardMock = {
  periodLabel: 'March 2026',
  revenueMonth: 184_200,
  profitMonth: 41_850,
  lossMonth: 3_200,
  ordersMonth: 156,
  avgOrderValue: 1_180,
  openOrders: 12,
  lowStockSkus: 4,
  repeatCustomerPercent: 38,
  newCustomersMonth: 42,
  returningCustomersMonth: 28,
  monthly: [
    { month: 'Oct', revenue: 142_000, profit: 31_200, loss: 2_100 },
    { month: 'Nov', revenue: 158_400, profit: 35_800, loss: 2_800 },
    { month: 'Dec', revenue: 201_500, profit: 48_200, loss: 4_100 },
    { month: 'Jan', revenue: 167_300, profit: 37_400, loss: 2_400 },
    { month: 'Feb', revenue: 175_900, profit: 39_100, loss: 2_950 },
    { month: 'Mar', revenue: 184_200, profit: 41_850, loss: 3_200 },
  ],
  topProducts: [
    { name: 'Whole wheat atta 10kg', unitsSold: 89, revenue: 62_300 },
    { name: 'Refined oil 5L', unitsSold: 64, revenue: 48_900 },
    { name: 'Toor dal 1kg', unitsSold: 112, revenue: 31_200 },
    { name: 'Sugar 5kg', unitsSold: 71, revenue: 22_400 },
    { name: 'Tea premium 500g', unitsSold: 45, revenue: 18_750 },
  ],
};
