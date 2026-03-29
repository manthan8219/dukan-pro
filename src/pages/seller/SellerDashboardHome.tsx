import type { ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { isSellerOnboardingComplete } from '../../auth/session';
import type { SellerOutletContext } from './SellerLayout';
import type { MonthlyMetric, SellerDashboardMock } from './sellerDashboardMock';
import { SELLER_DASHBOARD_MOCK } from './sellerDashboardMock';

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatINRCompact(value: number): string {
  if (value >= 100_000) {
    return `₹${(value / 100_000).toFixed(2)}L`;
  }
  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}k`;
  }
  return formatINR(value);
}

function MonthlyPerformanceChart({ monthly }: { monthly: MonthlyMetric[] }) {
  const W = 640;
  const H = 220;
  const pad = { top: 24, right: 20, bottom: 40, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxVal = Math.max(...monthly.flatMap((m) => [m.revenue, m.profit, m.loss]), 1);
  const groupCount = monthly.length;
  const groupW = innerW / groupCount;
  const barW = (groupW - 10) / 3;

  return (
    <svg
      className="sdash__chartSvg"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="220"
      role="img"
      aria-label="Monthly revenue, profit, and loss bars (sample data)"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.top + innerH * (1 - t);
        const v = Math.round(maxVal * t);
        return (
          <g key={t}>
            <line
              x1={pad.left}
              y1={y}
              x2={W - pad.right}
              y2={y}
              className="sdash__chartGridLine"
            />
            <text x={pad.left - 8} y={y + 4} className="sdash__chartAxis" textAnchor="end">
              {formatINRCompact(v)}
            </text>
          </g>
        );
      })}
      {monthly.map((m, i) => {
        const gx = pad.left + i * groupW + groupW / 2 - (barW * 3 + 8) / 2;
        const revH = (m.revenue / maxVal) * innerH;
        const profH = (m.profit / maxVal) * innerH;
        const lossH = (m.loss / maxVal) * innerH;
        const baseY = pad.top + innerH;
        return (
          <g key={m.month}>
            <rect
              x={gx}
              y={baseY - revH}
              width={barW}
              height={revH}
              rx={4}
              className="sdash__chartBar sdash__chartBar--revenue"
            />
            <rect
              x={gx + barW + 4}
              y={baseY - profH}
              width={barW}
              height={profH}
              rx={4}
              className="sdash__chartBar sdash__chartBar--profit"
            />
            <rect
              x={gx + barW * 2 + 8}
              y={baseY - lossH}
              width={barW}
              height={lossH}
              rx={4}
              className="sdash__chartBar sdash__chartBar--loss"
            />
            <text
              x={gx + barW * 1.5 + 4}
              y={H - 12}
              className="sdash__chartAxis sdash__chartAxis--month"
              textAnchor="middle"
            >
              {m.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function KpiCard({
  label,
  value,
  hint,
  variant,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  variant?: 'default' | 'profit' | 'loss';
}) {
  return (
    <div className={`sdash__card sdash__kpiCard${variant && variant !== 'default' ? ` sdash__kpiCard--${variant}` : ''}`}>
      <div className="sdash__cardLabel">{label}</div>
      <div className="sdash__cardValue">{value}</div>
      {hint ? <div className="sdash__cardHint">{hint}</div> : null}
    </div>
  );
}

export function SellerDashboardHome() {
  const { shopId } = useOutletContext<SellerOutletContext>();
  const onboardingDone = isSellerOnboardingComplete();
  const d: SellerDashboardMock = SELLER_DASHBOARD_MOCK;
  const mixTotal = d.newCustomersMonth + d.returningCustomersMonth;
  const newMixPct = mixTotal > 0 ? (d.newCustomersMonth / mixTotal) * 100 : 50;
  const retMixPct = mixTotal > 0 ? (d.returningCustomersMonth / mixTotal) * 100 : 50;

  return (
    <>
      <div className="sdash__panel sdash__panel--dashHead" style={{ marginBottom: '1.25rem' }}>
        <div className="sdash__panelHead">
          <h2>Welcome to your seller hub</h2>
          <span className="sdash__mockPill" title="Numbers below are for layout only until the API is connected">
            Sample data
          </span>
        </div>
        <p>
          Use the menu for billing, orders, and stock. The overview below shows the metrics we’ll fill from your API —
          revenue, profit, losses, and customer loyalty.
        </p>
        {!shopId &&
          (onboardingDone ? (
            <p style={{ marginTop: '0.75rem' }}>
              Shop id missing in this browser — open{' '}
              <Link to="/onboarding/seller" style={{ fontWeight: 700, color: '#0d9488' }}>
                shop setup
              </Link>{' '}
              to relink, or sign in again on this device.
            </p>
          ) : (
            <p style={{ marginTop: '0.75rem' }}>
              No shop id in this browser yet — run{' '}
              <Link to="/onboarding/seller" style={{ fontWeight: 700, color: '#0d9488' }}>
                onboarding
              </Link>{' '}
              to create one.
            </p>
          ))}
      </div>

      <p className="sdash__sectionLabel">This month ({d.periodLabel})</p>
      <div className="sdash__grid sdash__kpiGrid">
        <KpiCard label="Revenue" value={formatINR(d.revenueMonth)} hint="Gross sales in period" />
        <KpiCard label="Profit" value={formatINR(d.profitMonth)} variant="profit" hint="After estimated costs" />
        <KpiCard label="Loss / leakage" value={formatINR(d.lossMonth)} variant="loss" hint="Returns, wastage, shrink" />
        <KpiCard label="Orders" value={String(d.ordersMonth)} hint={`AOV ${formatINR(d.avgOrderValue)}`} />
      </div>

      <div className="sdash__grid sdash__kpiGrid sdash__kpiGrid--secondary" style={{ marginTop: '1rem' }}>
        <KpiCard
          label="Open orders"
          value={String(d.openOrders)}
          hint={
            <Link to="/app/seller/orders" className="sdash__inlineLink">
              Order desk →
            </Link>
          }
        />
        <KpiCard
          label="Low stock SKUs"
          value={String(d.lowStockSkus)}
          hint={
            <Link to="/app/seller/inventory" className="sdash__inlineLink">
              Inventory →
            </Link>
          }
        />
        <KpiCard
          label="Repeat customers"
          value={`${d.repeatCustomerPercent}%`}
          hint="Bought more than once in window"
        />
        <KpiCard
          label="New vs returning"
          value={`${d.newCustomersMonth} / ${d.returningCustomersMonth}`}
          hint="Customers this month"
        />
      </div>

      <div className="sdash__split" style={{ marginTop: '1.5rem' }}>
        <div className="sdash__panel sdash__chartPanel">
          <div className="sdash__panelHead sdash__panelHead--tight">
            <h3 className="sdash__h3">Monthly performance</h3>
            <div className="sdash__chartLegend">
              <span className="sdash__legendItem sdash__legendItem--revenue">Revenue</span>
              <span className="sdash__legendItem sdash__legendItem--profit">Profit</span>
              <span className="sdash__legendItem sdash__legendItem--loss">Loss</span>
            </div>
          </div>
          <MonthlyPerformanceChart monthly={d.monthly} />
        </div>

        <div className="sdash__panel sdash__sideStack">
          <div>
            <h3 className="sdash__h3">Top movers</h3>
            <p className="sdash__sideHint">By revenue — sample catalog</p>
            <table className="sdash__table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="sdash__tableNum">Units</th>
                  <th className="sdash__tableNum">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {d.topProducts.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className="sdash__tableNum">{row.unitsSold}</td>
                    <td className="sdash__tableNum">{formatINR(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sdash__customerMix">
            <h3 className="sdash__h3">Customer mix</h3>
            <div className="sdash__mixBar" role="presentation">
              <div
                className="sdash__mixBarSeg sdash__mixBarSeg--new"
                style={{ width: `${newMixPct}%` }}
                title="New"
              />
              <div
                className="sdash__mixBarSeg sdash__mixBarSeg--returning"
                style={{ width: `${retMixPct}%` }}
                title="Returning"
              />
            </div>
            <div className="sdash__mixLabels">
              <span>
                <i className="sdash__mixDot sdash__mixDot--new" /> New ({d.newCustomersMonth})
              </span>
              <span>
                <i className="sdash__mixDot sdash__mixDot--returning" /> Returning ({d.returningCustomersMonth})
              </span>
            </div>
          </div>

          <Link to="/app/seller/billing" className="sdash__quickLink">
            Create bill / invoice →
          </Link>
        </div>
      </div>
    </>
  );
}
