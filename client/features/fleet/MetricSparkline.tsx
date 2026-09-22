type Point = { ts: number; value: number | null };

type SparklineProps = {
  title: string;
  unit: string;
  points: Point[];
  colorVar?: string;
};

export function MetricSparkline({
  title,
  unit,
  points,
  colorVar = 'var(--color-accent)',
}: SparklineProps) {
  const width = 560;
  const height = 140;
  const pad = 12;
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;

  const coords = points
    .map((p, i) => {
      if (p.value == null || !Number.isFinite(p.value)) return null;
      const x = pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter((c): c is string => c != null);

  const latest = values.length ? values[values.length - 1] : null;

  return (
    <section className="glass-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        <p className="text-muted text-xs">
          {latest == null ? '-' : `${latest.toFixed(1)} ${unit}`}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-36 w-full"
        role="img"
        aria-label={`${title} chart`}
      >
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="var(--color-glass-border)"
          strokeWidth="1"
        />
        {coords.length > 1 ? (
          <polyline fill="none" stroke={colorVar} strokeWidth="2" points={coords.join(' ')} />
        ) : (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="var(--color-muted)"
            fontSize="12"
          >
            No data in range
          </text>
        )}
      </svg>
    </section>
  );
}
