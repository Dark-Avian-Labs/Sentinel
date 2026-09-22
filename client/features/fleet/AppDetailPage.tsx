import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { GlassCard } from '../../components/ui/GlassCard';
import { apiFetch } from '../../utils/api';
import { MetricSparkline } from './MetricSparkline';

const RANGES = [
  { id: '1h', label: '1h' },
  { id: '6h', label: '6h' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'today', label: 'Today' },
] as const;

type DetailPayload = {
  app: { id: string; displayName: string; pm2Name: string | null };
  range: string;
  points: Array<{
    ts: number;
    cpu: number | null;
    rssMb: number | null;
    heapMb: number | null;
    heapTotalMb: number | null;
    heapExternalMb: number | null;
    lagP95Ms: number | null;
    elu: number | null;
    gcP95Ms: number | null;
  }>;
  http: Array<{
    ts: number;
    count: number;
    latencyP95Ms: number | null;
    reqPerSec: number | null;
    errorRate: number | null;
  }>;
  eventRates: Array<{ ts: number; graceful: number; crash: number }>;
  events: Array<{
    id: number;
    ts: number;
    kind: string;
    exitCode: number | null;
    signal: string | null;
    message: string | null;
    source: string;
  }>;
};

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function AppDetailPage() {
  const { appId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get('range') || '24h';
  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(
          `/api/fleet/${encodeURIComponent(appId)}?range=${encodeURIComponent(range)}`,
        );
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setError('Sign in as a Sentinel admin to view this app.');
          return;
        }
        if (res.status === 404) {
          if (!cancelled) setError('App not found.');
          return;
        }
        if (!res.ok) throw new Error(`Detail request failed (${res.status})`);
        const payload = (await res.json()) as DetailPayload;
        if (!cancelled) {
          setError(null);
          setData(payload);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load app');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appId, range]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GlassCard className="p-8">
        <Link to="/" className="text-muted text-xs tracking-[0.2em] uppercase hover:underline">
          Fleet
        </Link>
        <h1 className="text-foreground mt-2 text-3xl font-semibold">
          {data?.app.displayName ?? appId}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={range === item.id ? 'header-link active' : 'header-link'}
              onClick={() => setSearchParams({ range: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {error ? <div className="error-msg">{error}</div> : null}

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <MetricSparkline
              title="CPU"
              unit="%"
              points={data.points.map((p) => ({ ts: p.ts, value: p.cpu }))}
            />
            <MetricSparkline
              title="RSS"
              unit="MB"
              points={data.points.map((p) => ({ ts: p.ts, value: p.rssMb }))}
            />
            <MetricSparkline
              title="Heap used"
              unit="MB"
              points={data.points.map((p) => ({ ts: p.ts, value: p.heapMb }))}
            />
            <MetricSparkline
              title="Heap total"
              unit="MB"
              points={data.points.map((p) => ({ ts: p.ts, value: p.heapTotalMb }))}
            />
            <MetricSparkline
              title="Heap external"
              unit="MB"
              points={data.points.map((p) => ({ ts: p.ts, value: p.heapExternalMb }))}
            />
            <MetricSparkline
              title="Event loop utilization"
              unit="%"
              points={data.points.map((p) => ({
                ts: p.ts,
                value: p.elu == null ? null : p.elu * 100,
              }))}
            />
            <MetricSparkline
              title="Event loop lag p95"
              unit="ms"
              points={data.points.map((p) => ({ ts: p.ts, value: p.lagP95Ms }))}
            />
            <MetricSparkline
              title="GC pause p95"
              unit="ms"
              points={data.points.map((p) => ({ ts: p.ts, value: p.gcP95Ms }))}
            />
            <MetricSparkline
              title="Request rate"
              unit="req/s"
              points={data.http.map((p) => ({ ts: p.ts, value: p.reqPerSec }))}
            />
            <MetricSparkline
              title="Error rate"
              unit="%"
              points={data.http.map((p) => ({
                ts: p.ts,
                value: p.errorRate == null ? null : p.errorRate * 100,
              }))}
            />
            <MetricSparkline
              title="HTTP latency p95"
              unit="ms"
              points={data.http.map((p) => ({ ts: p.ts, value: p.latencyP95Ms }))}
            />
            <MetricSparkline
              title="Restarts (graceful)"
              unit="count"
              points={data.eventRates.map((p) => ({ ts: p.ts, value: p.graceful }))}
            />
            <MetricSparkline
              title="Crashes"
              unit="count"
              points={data.eventRates.map((p) => ({ ts: p.ts, value: p.crash }))}
            />
          </div>

          <GlassCard className="p-6">
            <h2 className="text-foreground text-lg font-semibold">Events</h2>
            <p className="text-muted mt-1 text-sm">Graceful restarts vs crashes in this range.</p>
            {data.events.length === 0 ? (
              <p className="text-muted mt-4 text-sm">No events in range.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {data.events.map((event) => (
                  <li
                    key={event.id}
                    className="border-glass-border flex flex-wrap items-baseline justify-between gap-2 border-b py-2 text-sm last:border-0"
                  >
                    <span className="text-foreground font-medium">
                      {event.kind}
                      {event.signal ? ` (${event.signal})` : ''}
                      {event.exitCode != null ? ` exit ${event.exitCode}` : ''}
                    </span>
                    <span className="text-muted text-xs">{formatTs(event.ts)}</span>
                    {event.message ? (
                      <p className="text-muted w-full text-xs">{event.message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}
