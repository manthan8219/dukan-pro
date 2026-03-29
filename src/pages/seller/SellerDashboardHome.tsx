import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { isSellerOnboardingComplete } from '../../auth/session';
import type { SellerDashboard, SellerDashboardMonthly } from '../../api/sellerDashboard';
import { fetchSellerDashboard } from '../../api/sellerDashboard';
import type { SellerOutletContext } from './SellerLayout';

function formatINR(valueRupees: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(valueRupees);
}

function formatINRCompact(valueRupees: number): string {
  if (valueRupees >= 100_000) {
    return `₹${(valueRupees / 100_000).toFixed(2)}L`;
  }
  if (valueRupees >= 1000) {
    return `₹${(valueRupees / 1000).toFixed(1)}k`;
  }
  return formatINR(valueRupees);
}

function minorToRupees(minor: number): number {
  return minor / 100;
}

function MonthlyPerformanceChart({ monthly }: { monthly: SellerDashboardMonthly[] }) {
  const W = 640;
  const H = 220;
  const pad = { top: 24, right: 20, bottom: 40, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const hasProfitLoss = monthly.some(
    (m) => m.profitMinor != null || m.lossMinor != null,
  );
  const maxVal = Math.max(
    ...monthly.flatMap((m) => {
      const parts = [minorToRupees(m.revenueMinor)];
      if (m.profitMinor != null) parts.push(minorToRupees(m.profitMinor));
      if (m.lossMinor != null) parts.push(minorToRupees(m.lossMinor));
      return parts;
    }),
    1,
  );
  const groupCount = monthly.length;
  const groupW = innerW / groupCount;
  const barCount = hasProfitLoss ? 3 : 1;
  const innerBarGap = hasProfitLoss ? 4 : 0;
  const barW = (groupW - 10 - innerBarGap * (barCount - 1)) / barCount;

  return (
    <svg
      className="sdash__chartSvg"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="220"
      role="img"
      aria-label={
        hasProfitLoss
          ? 'Monthly revenue, profit, and loss'
          : 'Monthly revenue (profit and loss not tracked)'
      }
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
        const gx = pad.left + i * groupW + groupW / 2 - (barW * barCount + innerBarGap * (barCount - 1)) / 2;
        const baseY = pad.top + innerH;
        const revH = (minorToRupees(m.revenueMinor) / maxVal) * innerH;
        const profH =
          hasProfitLoss && m.profitMinor != null
            ? (minorToRupees(m.profitMinor) / maxVal) * innerH
            : 0;
        const lossH =
          hasProfitLoss && m.lossMinor != null
            ? (minorToRupees(m.lossMinor) / maxVal) * innerH
            : 0;
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
            {hasProfitLoss ? (
              <>
                <rect
                  x={gx + barW + innerBarGap}
                  y={baseY - profH}
                  width={barW}
                  height={profH}
                  rx={4}
                  className="sdash__chartBar sdash__chartBar--profit"
                />
                <rect
                  x={gx + barW * 2 + innerBarGap * 2}
                  y={baseY - lossH}
                  width={barW}
                  height={lossH}
                  rx={4}
                  className="sdash__chartBar sdash__chartBar--loss"
                />
              </>
            ) : null}
            <text
              x={gx + (barW * barCount + innerBarGap * (barCount - 1)) / 2}
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
  const { backendProfile } = useAuth();
  const ownerUserId = backendProfile?.id ?? null;
  const onboardingDone = isSellerOnboardingComplete();

  const [data, setData] = useState<SellerDashboard | null>(null);
  const [loading, setLoading] = useState(() => Boolean(shopId && ownerUserId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId || !ownerUserId) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await fetchSellerDashboard(ownerUserId, shopId);
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, [shopId, ownerUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const d = data;
  const mixTotal =
    d != null ? d.newCustomersMonth + d.returningCustomersMonth : 0;
  const newMixPct = mixTotal > 0 ? (d!.newCustomersMonth / mixTotal) * 100 : 50;
  const retMixPct =
    mixTotal > 0 ? (d!.returningCustomersMonth / mixTotal) * 100 : 50;

  return (
    <>
      <div className="sdash__panel sdash__panel--dashHead" style={{ marginBottom: '1.25rem' }}>
        <div className="sdash__panelHead">
          <h2>Welcome to your seller hub</h2>
          {loading ? (
            <span className="sdash__mockPill" title="Loading dashboard">
              Loading…
            </span>
          ) : d ? (
            <span className="sdash__mockPill" title={d.metricsDefinition}>
              Live data
            </span>
          ) : null}
        </div>
        <p>
          Overview of sales, fulfilment, stock, and customers. Amounts use your shop’s order totals (including delivery
          share where applicable).
        </p>
        {error ? (
          <p style={{ marginTop: '0.75rem', color: '#b91c1c' }}>
            {error}{' '}
            <button
              type="button"
              className="sdash__inlineLink"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
              onClick={() => void load()}
            >
              Retry
            </button>
          </p>
        ) : null}
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
        {shopId && !ownerUserId ? (
          <p style={{ marginTop: '0.75rem' }}>Sign in to load your dashboard.</p>
        ) : null}
      </div>

      {d ? (
        <>
          <p className="sdash__sectionLabel">This month ({d.periodLabel})</p>
          <div className="sdash__grid sdash__kpiGrid">
            <KpiCard
              label="Revenue"
              value={formatINR(minorToRupees(d.revenueMonthMinor))}
              hint="Non-cancelled orders placed this month (UTC)"
            />
            <KpiCard
              label="Profit"
              value={d.profitMonthMinor != null ? formatINR(minorToRupees(d.profitMonthMinor)) : '—'}
              variant="profit"
              hint={d.profitMonthMinor == null ? 'Add cost data to track margin' : 'After estimated costs'}
            />
            <KpiCard
              label="Loss / leakage"
              value={d.lossMonthMinor != null ? formatINR(minorToRupees(d.lossMonthMinor)) : '—'}
              variant="loss"
              hint={d.lossMonthMinor == null ? 'Returns & shrink not modeled yet' : 'Returns, wastage, shrink'}
            />
            <KpiCard
              label="Orders"
              value={String(d.ordersMonth)}
              hint={`AOV ${formatINR(minorToRupees(d.avgOrderValueMinor))}`}
            />
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
              hint="2+ orders from same buyer this month"
            />
            <KpiCard
              label="New vs returning"
              value={`${d.newCustomersMonth} / ${d.returningCustomersMonth}`}
              hint="Distinct buyers this month"
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
                <p className="sdash__sideHint">By revenue — this month (UTC)</p>
                <table className="sdash__table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="sdash__tableNum">Units</th>
                      <th className="sdash__tableNum">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.topProducts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="sdash__sideHint">
                          No sales this period
                        </td>
                      </tr>
                    ) : (
                      d.topProducts.map((row, idx) => (
                        <tr key={`${idx}-${row.name}`}>
                          <td>{row.name}</td>
                          <td className="sdash__tableNum">{row.unitsSold}</td>
                          <td className="sdash__tableNum">{formatINR(minorToRupees(row.revenueMinor))}</td>
                        </tr>
                      ))
                    )}
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
                    <i className="sdash__mixDot sdash__mixDot--returning" /> Returning (
                    {d.returningCustomersMonth})
                  </span>
                </div>
              </div>

              <Link to="/app/seller/billing" className="sdash__quickLink">
                Create bill / invoice →
              </Link>
            </div>
          </div>
        </>
      ) : !loading && shopId && ownerUserId ? (
        <p className="sdash__sectionLabel">No dashboard data yet.</p>
      ) : null}
    </>
  );
}
