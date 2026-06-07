type PricePoint = {
  price_date: string;
  unit_price_jpy: number;
};

type Props = {
  prices: PricePoint[];
};

const MIN_DISPLAY_POINTS = 2;

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatYLabel(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000)    return `${(v / 1000).toFixed(0)}K`;
  return v.toLocaleString("ja-JP");
}

function pickXLabelIndices(total: number, maxLabels: number): number[] {
  if (total <= maxLabels) return Array.from({ length: total }, (_, i) => i);
  return Array.from({ length: maxLabels }, (_, i) =>
    Math.round((i / (maxLabels - 1)) * (total - 1))
  );
}

// Smooth curve: compute a cubic bezier "smooth polyline" via control points
function smoothPath(xs: number[], ys: number[]): string {
  if (xs.length < 2) return "";
  if (xs.length === 2) {
    return `M ${xs[0]} ${ys[0]} L ${xs[1]} ${ys[1]}`;
  }
  let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 1; i < xs.length; i++) {
    const tension = 0.2;
    const x0 = xs[Math.max(0, i - 2)];
    const y0 = ys[Math.max(0, i - 2)];
    const x1 = xs[i - 1];
    const y1 = ys[i - 1];
    const x2 = xs[i];
    const y2 = ys[i];
    const x3 = xs[Math.min(xs.length - 1, i + 1)];
    const y3 = ys[Math.min(ys.length - 1, i + 1)];

    const cp1x = x1 + (x2 - x0) * tension;
    const cp1y = y1 + (y2 - y0) * tension;
    const cp2x = x2 - (x3 - x1) * tension;
    const cp2y = y2 - (y3 - y1) * tension;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

export default function FullLineChart({ prices }: Props) {
  if (prices.length === 0) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl bg-[#F6FBF6]">
        <span className="text-2xl">📈</span>
        <p className="text-sm font-bold text-[#7A9E7E]">まだチャートデータがありません</p>
        <p className="text-xs text-[#7A9E7E]">価格データが追加されると表示されます</p>
      </div>
    );
  }

  if (prices.length < MIN_DISPLAY_POINTS) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl bg-[#F6FBF6]">
        <span className="text-2xl">⏳</span>
        <p className="text-sm font-bold text-[#7A9E7E]">データを収集中です</p>
        <p className="text-xs text-[#7A9E7E]">もうしばらくお待ちください</p>
      </div>
    );
  }

  const values = prices.map((p) => p.unit_price_jpy);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin;

  // Add 10% padding above/below so the line isn't cramped at edges
  const pad = rawRange * 0.12 || rawMax * 0.05 || 1;
  const minVal = rawMin - pad;
  const maxVal = rawMax + pad;
  const range = maxVal - minVal;

  const svgW = 560;
  const svgH = 190;
  const padL = 46;
  const padR = 12;
  const padT = 10;
  const padB = 32;
  const cW = svgW - padL - padR;
  const cH = svgH - padT - padB;

  const toX = (i: number) => padL + (i / (prices.length - 1)) * cW;
  const toY = (v: number) => padT + cH - ((v - minVal) / range) * cH;

  const xs = prices.map((_, i) => toX(i));
  const ys = prices.map((p) => toY(p.unit_price_jpy));

  const linePath = smoothPath(xs, ys);

  // Area path: close to bottom
  const areaPath =
    `${linePath} L ${xs[xs.length - 1].toFixed(1)} ${(padT + cH).toFixed(1)} L ${padL} ${(padT + cH).toFixed(1)} Z`;

  const isPositive = values[values.length - 1] >= values[0];
  const lineColor = isPositive ? "#4BAF57" : "#EF5350";
  const areaTop = isPositive ? "#4BAF57" : "#EF5350";

  // Y-axis: 5 grid lines
  const ySteps = 5;
  const yGridValues = Array.from({ length: ySteps }, (_, i) =>
    rawMin + (rawMax - rawMin) * (i / (ySteps - 1))
  );

  // X labels: up to 7
  const xLabelIdx = pickXLabelIndices(prices.length, 7);

  // Dot: only show at data points when there are few points; for dense data skip dots
  const showDots = prices.length <= 30;

  return (
    <div className="w-full overflow-x-auto rounded-2xl">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        style={{ minWidth: 260, maxHeight: 220, height: "auto" }}
        aria-label="価格チャート"
      >
        <defs>
          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaTop} stopOpacity="0.18" />
            <stop offset="85%" stopColor={areaTop} stopOpacity="0.03" />
            <stop offset="100%" stopColor={areaTop} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="chart-line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.7" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yGridValues.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line
                x1={padL} y1={y} x2={padL + cW} y2={y}
                stroke="#E8F5E9" strokeWidth={i === 0 ? "1.5" : "0.8"}
                strokeDasharray={i === 0 ? "none" : "4 4"}
              />
              <text
                x={padL - 6} y={y + 4}
                textAnchor="end" fontSize="9.5" fill="#9DBFA1" fontWeight="500"
              >
                {formatYLabel(Math.round(v))}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#chart-area-grad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#chart-line-grad)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots (sparse data only) */}
        {showDots &&
          xs.map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy={ys[i]}
              r="3.5"
              fill="white"
              stroke={lineColor}
              strokeWidth="2"
            />
          ))
        }

        {/* Latest price dot (always) */}
        {!showDots && (
          <>
            <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="5" fill={lineColor} opacity="0.2" />
            <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill="white" stroke={lineColor} strokeWidth="2" />
          </>
        )}

        {/* X-axis baseline */}
        <line
          x1={padL} y1={padT + cH} x2={padL + cW} y2={padT + cH}
          stroke="#D4EDDA" strokeWidth="1.5"
        />

        {/* X-axis labels */}
        {xLabelIdx.map((idx) => (
          <text
            key={idx}
            x={xs[idx]}
            y={svgH - 6}
            textAnchor="middle"
            fontSize="9.5"
            fill="#9DBFA1"
            fontWeight="500"
          >
            {formatDateLabel(prices[idx].price_date)}
          </text>
        ))}

        {/* Data point count badge */}
        {prices.length < 10 && (
          <text
            x={padL + cW}
            y={padT}
            textAnchor="end"
            fontSize="9"
            fill="#B0C8B5"
          >
            {prices.length}日分
          </text>
        )}
      </svg>
    </div>
  );
}
