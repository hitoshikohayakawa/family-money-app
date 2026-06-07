type PricePoint = {
  price_date: string;
  unit_price_jpy: number;
};

type Props = {
  prices: PricePoint[];
  positive?: boolean | null;
  width?: number;
  height?: number;
  gradientId?: string;
};

export default function MiniLineChart({ prices, positive, width = 120, height = 40, gradientId = "mini-fill" }: Props) {
  if (prices.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-[#7A9E7E]">-</div>;
  }

  const values = prices.map((p) => p.unit_price_jpy);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const padX = 2;
  const padY = 3;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * chartW;
    const y = padY + chartH - ((v - minVal) / range) * chartH;
    return `${x},${y}`;
  });

  const strokeColor = positive === false ? "#E57373" : "#4BAF57";
  const fillId = gradientId;
  const lastPoint = points[points.length - 1].split(",");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${padX},${padY + chartH} ${points.join(" ")} ${lastPoint[0]},${padY + chartH}`}
        fill={`url(#${fillId})`}
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
