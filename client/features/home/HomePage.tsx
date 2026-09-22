import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { APP_DISPLAY_NAME } from '../../app/config';
import { appDetailPath } from '../../app/paths';
import { GlassCard } from '../../components/ui/GlassCard';
import { apiFetch } from '../../utils/api';

type FleetApp = {
  id: string;
  displayName: string;
  cpu: number | null;
  rssMb: number | null;
  lagP95Ms: number | null;
  elu: number | null;
  uptimeSec: number | null;
  status: string | null;
  crashCount24h: number;
  restartCount24h: number;
  reqPerSec1h: number | null;
  errorRate1h: number | null;
};

type HostSnapshot = {
  ts: number;
  load1: number | null;
  load5: number | null;
  memUsedPct: number | null;
};

function formatUptime(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '-';
  const s = Math.floor(sec);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function HomePage() {
  const [apps, setApps] = useState<FleetApp[] | null>(null);
  const [host, setHost] = useState<HostSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/fleet');
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) {
            setApps([]);
            setError('Sign in as a Sentinel admin to view the fleet.');
          }
          return;
        }
        if (!res.ok) {
          throw new Error(`Fleet request failed (${res.status})`);
        }
        const data = (await res.json()) as { apps: FleetApp[]; host: HostSnapshot | null };
        if (!cancelled) {
          setError(null);
          setApps(data.apps);
          setHost(data.host);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load fleet');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GlassCard className="p-8">
        <p className="text-muted text-xs tracking-[0.25em] uppercase">{APP_DISPLAY_NAME}</p>
        <h1 className="text-foreground mt-2 text-3xl font-semibold">Fleet</h1>
        <p className="text-muted mt-3 max-w-2xl text-sm leading-relaxed">
          CPU, RAM, lag, ELU, traffic, and restart vs crash counts for PM2 apps on this host. Admin
          access requires Clerk metadata apps.sentinel = admin.
        </p>
        {host ? (
          <dl className="text-muted mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              Load 1m{' '}
              <span className="text-foreground">
                {host.load1 == null ? '-' : host.load1.toFixed(2)}
              </span>
            </div>
            <div>
              Host RAM{' '}
              <span className="text-foreground">
                {host.memUsedPct == null ? '-' : `${host.memUsedPct.toFixed(0)}%`}
              </span>
            </div>
          </dl>
        ) : null}
      </GlassCard>

      {error ? <div className="error-msg">{error}</div> : null}

      {apps && apps.length === 0 && !error ? (
        <GlassCard className="p-8">
          <p className="text-muted text-sm">
            No samples yet. Start the PM2 bridge on the server host, or point an in-app agent at
            /api/ingest.
          </p>
        </GlassCard>
      ) : null}

      {apps && apps.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {apps.map((app) => (
            <Link key={app.id} to={appDetailPath(app.id)} className="block no-underline">
              <GlassCard className="p-6 transition-colors hover:border-[var(--color-glass-border-hover)]">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-foreground text-lg font-semibold">{app.displayName}</h2>
                  <span className="text-muted text-xs uppercase">{app.status ?? 'unknown'}</span>
                </div>
                <dl className="text-muted mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt>CPU</dt>
                    <dd className="text-foreground mt-1">
                      {app.cpu == null ? '-' : `${app.cpu.toFixed(1)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>RSS</dt>
                    <dd className="text-foreground mt-1">
                      {app.rssMb == null ? '-' : `${app.rssMb.toFixed(0)} MB`}
                    </dd>
                  </div>
                  <div>
                    <dt>ELU</dt>
                    <dd className="text-foreground mt-1">
                      {app.elu == null ? '-' : `${(app.elu * 100).toFixed(0)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>Uptime</dt>
                    <dd className="text-foreground mt-1">{formatUptime(app.uptimeSec)}</dd>
                  </div>
                  <div>
                    <dt>RPS (1h)</dt>
                    <dd className="text-foreground mt-1">
                      {app.reqPerSec1h == null ? '-' : app.reqPerSec1h.toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt>Errors (1h)</dt>
                    <dd className="text-foreground mt-1">
                      {app.errorRate1h == null ? '-' : `${(app.errorRate1h * 100).toFixed(1)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>Lag p95</dt>
                    <dd className="text-foreground mt-1">
                      {app.lagP95Ms == null ? '-' : `${app.lagP95Ms.toFixed(1)} ms`}
                    </dd>
                  </div>
                  <div>
                    <dt>24h events</dt>
                    <dd className="text-foreground mt-1">
                      {app.restartCount24h} restart / {app.crashCount24h} crash
                    </dd>
                  </div>
                </dl>
              </GlassCard>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
