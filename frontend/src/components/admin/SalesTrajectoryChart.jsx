import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  Calendar, 
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  IndianRupee
} from 'lucide-react';
import './SalesTrajectoryChart.css';

/**
 * Calculates a friendly rounded ceiling for chart axis scaling
 */
function getNiceMax(val, defaultMin = 10) {
  if (val <= 0) return defaultMin;
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  const normalized = val / magnitude;
  let niceNorm;
  if (normalized <= 1) niceNorm = 1;
  else if (normalized <= 2) niceNorm = 2;
  else if (normalized <= 2.5) niceNorm = 2.5;
  else if (normalized <= 5) niceNorm = 5;
  else niceNorm = 10;
  return niceNorm * magnitude;
}

/**
 * Formats rupee values cleanly for Y-axis ticks
 */
function formatRupeeTick(val) {
  if (val === 0) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return `₹${Math.round(val)}`;
}

export default function SalesTrajectoryChart({
  data = [],
  selectedDays = 7,
  onSelectDays,
  isLoading = false
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Chart Geometry Coordinates
  const svgWidth = 860;
  const svgHeight = 320;
  const marginLeft = 65;
  const marginRight = 55;
  const marginTop = 30;
  const marginBottom = 45;
  const plotWidth = svgWidth - marginLeft - marginRight;
  const plotHeight = svgHeight - marginTop - marginBottom;

  // Aggregate metrics and scales
  const {
    maxRevenue,
    maxOrders,
    windowTotalRevenue,
    windowTotalOrders,
    yTicks
  } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        maxRevenue: 10000,
        maxOrders: 20,
        windowTotalRevenue: 0,
        windowTotalOrders: 0,
        yTicks: [0, 0.25, 0.5, 0.75, 1]
      };
    }

    const rawMaxRev = Math.max(...data.map(d => Number(d.totalSales) || 0), 0);
    const rawMaxOrd = Math.max(...data.map(d => Number(d.totalOrders) || 0), 0);
    const totRev = data.reduce((acc, d) => acc + (Number(d.totalSales) || 0), 0);
    const totOrd = data.reduce((acc, d) => acc + (Number(d.totalOrders) || 0), 0);

    const calcMaxRev = getNiceMax(rawMaxRev > 0 ? rawMaxRev * 1.15 : 5000, 5000);
    const calcMaxOrd = getNiceMax(rawMaxOrd > 0 ? rawMaxOrd * 1.15 : 10, 10);

    return {
      maxRevenue: calcMaxRev,
      maxOrders: calcMaxOrd,
      windowTotalRevenue: totRev,
      windowTotalOrders: totOrd,
      yTicks: [0, 0.25, 0.5, 0.75, 1]
    };
  }, [data]);

  const numPoints = data ? data.length : 0;
  const stepWidth = numPoints > 0 ? plotWidth / numPoints : 0;
  const barWidth = Math.min(38, Math.max(8, stepWidth * 0.52));

  // Compute coordinates for data series
  const seriesPoints = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((d, i) => {
      const xCenter = marginLeft + (i + 0.5) * stepWidth;
      const sales = Number(d.totalSales) || 0;
      const orders = Number(d.totalOrders) || 0;

      const barHeight = maxRevenue > 0 ? (sales / maxRevenue) * plotHeight : 0;
      const barY = marginTop + plotHeight - barHeight;
      const barX = xCenter - barWidth / 2;

      const orderY = maxOrders > 0 
        ? marginTop + plotHeight - (orders / maxOrders) * plotHeight 
        : marginTop + plotHeight;

      return {
        ...d,
        index: i,
        xCenter,
        barX,
        barY,
        barHeight: Math.max(sales > 0 ? 3 : 0, barHeight),
        orderY,
        sales,
        orders
      };
    });
  }, [data, stepWidth, barWidth, maxRevenue, maxOrders, plotHeight, marginLeft, marginTop]);

  // Construct trajectory SVG path for order volume line
  const orderLinePath = useMemo(() => {
    if (seriesPoints.length === 0) return '';
    return seriesPoints.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.xCenter} ${pt.orderY}` : `${acc} L ${pt.xCenter} ${pt.orderY}`;
    }, '');
  }, [seriesPoints]);

  const activePoint = hoveredIndex !== null && seriesPoints[hoveredIndex] 
    ? seriesPoints[hoveredIndex] 
    : null;

  // Decide date label display intervals for readability
  const shouldShowLabel = (idx) => {
    if (numPoints <= 7) return true;
    if (numPoints <= 14) return idx % 2 === 0 || idx === numPoints - 1;
    return idx % 4 === 0 || idx === numPoints - 1;
  };

  return (
    <div className="sales-trajectory-card">
      {/* 1. Header with Range Selector Controls */}
      <div className="sales-trajectory-header">
        <div className="sales-trajectory-title">
          <h3>
            <BarChart3 size={20} color="#7A1C1C" />
            <span>Daily Sales &amp; Order Trajectory</span>
          </h3>
          <p>Gross revenue volume (₹) and completed deliveries grouped by calendar day</p>
        </div>

        <div className="sales-trajectory-controls">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => onSelectDays && onSelectDays(days)}
              className={`range-btn ${selectedDays === days ? 'active' : ''}`}
              disabled={isLoading}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* 2. Legend & Window Summary Totals */}
      <div className="sales-trajectory-legend-bar">
        <div className="legend-items">
          <span className="legend-item">
            <span className="legend-swatch-bar" />
            <span>Daily Revenue (₹)</span>
          </span>
          <span className="legend-item">
            <span className="legend-swatch-line" />
            <span>Orders Trajectory</span>
          </span>
        </div>

        <div className="legend-summary-stats">
          <span className="summary-stat-pill">
            <span>Window Gross:</span>
            <strong>₹{windowTotalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          <span style={{ color: '#D4AF37' }}>&bull;</span>
          <span className="summary-stat-pill">
            <span>Total Orders:</span>
            <strong>{windowTotalOrders}</strong>
          </span>
        </div>
      </div>

      {/* 3. Main Plot Container */}
      <div className="chart-svg-container">
        {isLoading && (
          <div className="chart-loading-overlay">
            <RefreshCw size={22} className="spin" />
            <span>Loading telemetry trajectory...</span>
          </div>
        )}

        {(!data || data.length === 0) ? (
          <div className="chart-empty-state">
            <AlertCircle size={36} color="#B8860B" />
            <h4>No order telemetry recorded for the selected window</h4>
            <p>Once orders are placed and processed, daily financial metrics and order velocity will chart here.</p>
          </div>
        ) : (
          <>
            <svg 
              className="chart-svg" 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                {/* Revenue Bar Royal Maroon-Gold Gradient */}
                <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" />
                  <stop offset="35%" stopColor="#9C2738" />
                  <stop offset="100%" stopColor="#7A1C1C" />
                </linearGradient>

                {/* Hovered Bar Highlight Gradient */}
                <linearGradient id="revenueBarGradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FAD7A0" />
                  <stop offset="40%" stopColor="#B03042" />
                  <stop offset="100%" stopColor="#8A2238" />
                </linearGradient>

                {/* Subtle Area Glow beneath Order Line */}
                <linearGradient id="orderLineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E67E22" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#E67E22" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* ------------------------------------------------------------------ */}
              {/* Horizontal Grid Lines & Y-Axes Ticks                               */}
              {/* ------------------------------------------------------------------ */}
              {yTicks.map((fraction, idx) => {
                const y = marginTop + plotHeight - fraction * plotHeight;
                const revTickVal = fraction * maxRevenue;
                const ordTickVal = Math.round(fraction * maxOrders);

                return (
                  <g key={`grid-${idx}`}>
                    {/* Horizontal Guideline */}
                    <line
                      x1={marginLeft}
                      y1={y}
                      x2={svgWidth - marginRight}
                      y2={y}
                      stroke={idx === 0 ? '#CDB8A5' : '#EFE7DE'}
                      strokeWidth={idx === 0 ? '1.5' : '1'}
                      strokeDasharray={idx === 0 ? 'none' : '3 3'}
                    />

                    {/* Left Y-Axis Label (Currency) */}
                    <text
                      x={marginLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="#7A1C1C"
                      fontSize="10.5"
                      fontFamily="monospace"
                      fontWeight={idx === 0 ? '600' : '500'}
                    >
                      {formatRupeeTick(revTickVal)}
                    </text>

                    {/* Right Y-Axis Label (Order Count) */}
                    <text
                      x={svgWidth - marginRight + 8}
                      y={y + 4}
                      textAnchor="start"
                      fill="#D35400"
                      fontSize="10.5"
                      fontFamily="monospace"
                      fontWeight={idx === 0 ? '600' : '500'}
                    >
                      {ordTickVal}
                    </text>
                  </g>
                );
              })}

              {/* Left Y-Axis Title */}
              <text
                x={12}
                y={marginTop - 10}
                fill="#7A1C1C"
                fontSize="10.5"
                fontWeight="700"
                textAnchor="start"
              >
                Revenue (₹)
              </text>

              {/* Right Y-Axis Title */}
              <text
                x={svgWidth - 10}
                y={marginTop - 10}
                fill="#D35400"
                fontSize="10.5"
                fontWeight="700"
                textAnchor="end"
              >
                Orders
              </text>

              {/* ------------------------------------------------------------------ */}
              {/* Series 1: Daily Revenue Bars                                      */}
              {/* ------------------------------------------------------------------ */}
              {seriesPoints.map((pt) => {
                const isHovered = hoveredIndex === pt.index;

                return (
                  <g key={`bar-group-${pt.index}`}>
                    {/* Bar Rectangle */}
                    {pt.sales > 0 && (
                      <rect
                        className={`chart-bar-rect ${isHovered ? 'active' : ''}`}
                        x={pt.barX}
                        y={pt.barY}
                        width={barWidth}
                        height={pt.barHeight}
                        rx="3"
                        fill={isHovered ? 'url(#revenueBarGradActive)' : 'url(#revenueBarGrad)'}
                        stroke={isHovered ? '#D4AF37' : '#7A1C1C'}
                        strokeWidth="0.8"
                      />
                    )}

                    {/* Baseline indicator for 0 sales days */}
                    {pt.sales === 0 && (
                      <rect
                        x={pt.barX}
                        y={marginTop + plotHeight - 2}
                        width={barWidth}
                        height="2"
                        rx="1"
                        fill="#D0C4B8"
                      />
                    )}
                  </g>
                );
              })}

              {/* ------------------------------------------------------------------ */}
              {/* Series 2: Order Trajectory Line & Nodes                           */}
              {/* ------------------------------------------------------------------ */}
              {orderLinePath && (
                <path
                  d={orderLinePath}
                  fill="none"
                  stroke="#E67E22"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Node Circles on Trajectory Line */}
              {seriesPoints.map((pt) => {
                const isHovered = hoveredIndex === pt.index;

                return (
                  <circle
                    key={`point-${pt.index}`}
                    className={`chart-line-point ${isHovered ? 'active' : ''}`}
                    cx={pt.xCenter}
                    cy={pt.orderY}
                    r={isHovered ? 6.5 : 4}
                    fill={isHovered ? '#FFE6CC' : '#FFFFFF'}
                    stroke="#E67E22"
                    strokeWidth={isHovered ? 3 : 2}
                  />
                );
              })}

              {/* ------------------------------------------------------------------ */}
              {/* Hover Cursor Vertical Guide Line                                  */}
              {/* ------------------------------------------------------------------ */}
              {activePoint && (
                <line
                  x1={activePoint.xCenter}
                  y1={marginTop}
                  x2={activePoint.xCenter}
                  y2={marginTop + plotHeight}
                  stroke="#D4AF37"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  pointerEvents="none"
                />
              )}

              {/* ------------------------------------------------------------------ */}
              {/* Bottom X-Axis: Date Labels & Baseline                              */}
              {/* ------------------------------------------------------------------ */}
              {/* Horizontal X Baseline */}
              <line
                x1={marginLeft}
                y1={marginTop + plotHeight}
                x2={svgWidth - marginRight}
                y2={marginTop + plotHeight}
                stroke="#8A7365"
                strokeWidth="1.5"
              />

              {seriesPoints.map((pt) => {
                if (!shouldShowLabel(pt.index)) return null;
                const dObj = new Date(pt.date);
                const dayLabel = dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                const isHovered = hoveredIndex === pt.index;

                return (
                  <g key={`x-label-${pt.index}`}>
                    {/* Tick Mark */}
                    <line
                      x1={pt.xCenter}
                      y1={marginTop + plotHeight}
                      x2={pt.xCenter}
                      y2={marginTop + plotHeight + 5}
                      stroke="#8A7365"
                      strokeWidth="1"
                    />

                    {/* Date Label */}
                    <text
                      x={pt.xCenter}
                      y={marginTop + plotHeight + 20}
                      textAnchor="middle"
                      fill={isHovered ? '#7A1C1C' : '#6B5B52'}
                      fontSize={numPoints > 14 ? '10' : '11'}
                      fontWeight={isHovered ? '700' : '500'}
                    >
                      {dayLabel}
                    </text>
                  </g>
                );
              })}

              {/* ------------------------------------------------------------------ */}
              {/* Invisible Full-Height Hover Touch Columns                          */}
              {/* ------------------------------------------------------------------ */}
              {seriesPoints.map((pt) => (
                <rect
                  key={`hover-col-${pt.index}`}
                  x={marginLeft + pt.index * stepWidth}
                  y={marginTop}
                  width={stepWidth}
                  height={plotHeight + 25}
                  fill="transparent"
                  cursor="pointer"
                  onMouseEnter={() => setHoveredIndex(pt.index)}
                  onTouchStart={() => setHoveredIndex(pt.index)}
                />
              ))}
            </svg>

            {/* 4. Rich Interactive Tooltip Overlay */}
            {activePoint && (
              <div 
                className="chart-html-tooltip"
                style={{
                  left: `${(activePoint.xCenter / svgWidth) * 100}%`
                }}
              >
                <div className="tt-date">
                  {new Date(activePoint.date).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
                <div className="tt-row">
                  <span>Gross Sales:</span>
                  <span className="tt-revenue">
                    ₹{activePoint.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="tt-row">
                  <span>Total Orders:</span>
                  <span className="tt-orders">
                    {activePoint.orders} orders
                  </span>
                </div>
                <div className="tt-row">
                  <span>Delivered:</span>
                  <strong style={{ color: '#2ECC71' }}>
                    {activePoint.deliveredOrders || 0}
                  </strong>
                </div>
                <div className="tt-row">
                  <span>Cancelled:</span>
                  <strong style={{ color: '#E74C3C' }}>
                    {activePoint.cancelledOrders || 0}
                  </strong>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
