import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { appDetailPath } from '../../app/paths';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../auth/AuthContext';

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
  pmxModule: boolean;
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

function isOnline(status: string | null): boolean {
  return status === 'online';
}

function FleetTable({ apps }: { apps: FleetApp[] }) {
  const navigate = useNavigate();

  return (
    <div className="table-container glass-surface">
      <div className="table-scroll">
        <table className="fleet-table">
          <thead>
            <tr>
              <th className="col-status" scope="col" aria-label="Status" />
              <th scope="col">App</th>
              <th scope="col">CPU</th>
              <th scope="col">RSS</th>
              <th scope="col">ELU</th>
              <th scope="col">Uptime</th>
              <th scope="col">RPS</th>
              <th scope="col">Errors</th>
              <th scope="col">Lag p95</th>
              <th scope="col">24h events</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => {
              const online = isOnline(app.status);
              return (
                <tr
                  key={app.id}
                  className="fleet-row"
                  tabIndex={0}
                  role="link"
                  aria-label={`${app.displayName}, ${online ? 'online' : 'offline'}`}
                  onClick={() => navigate(appDetailPath(app.id))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(appDetailPath(app.id));
                    }
                  }}
                >
                  <td className="col-status">
                    <span
                      className={
                        online ? 'fleet-status-dot is-online' : 'fleet-status-dot is-offline'
                      }
                      title={app.status ?? 'unknown'}
                      aria-hidden="true"
                    />
                  </td>
                  <td className="text-foreground font-medium">{app.displayName}</td>
                  <td>{app.cpu == null ? '-' : `${app.cpu.toFixed(1)}%`}</td>
                  <td>{app.rssMb == null ? '-' : `${app.rssMb.toFixed(0)} MB`}</td>
                  <td>{app.elu == null ? '-' : `${(app.elu * 100).toFixed(0)}%`}</td>
                  <td>{formatUptime(app.uptimeSec)}</td>
                  <td>{app.reqPerSec1h == null ? '-' : app.reqPerSec1h.toFixed(2)}</td>
                  <td>
                    {app.errorRate1h == null ? '-' : `${(app.errorRate1h * 100).toFixed(1)}%`}
                  </td>
                  <td>{app.lagP95Ms == null ? '-' : `${app.lagP95Ms.toFixed(1)} ms`}</td>
                  <td>
                    {app.restartCount24h} / {app.crashCount24h}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HomePage() {
  const { auth } = useAuth();
  const [apps, setApps] = useState<FleetApp[] | null>(null);
  const [host, setHost] = useState<HostSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === 'loading') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/fleet');
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) {
            setApps([]);
            setError('Admin access required');
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
  }, [auth.status]);

  const appRows = apps?.filter((app) => !app.pmxModule) ?? [];
  const moduleRows = apps?.filter((app) => app.pmxModule) ?? [];

  return (
    <div className="space-y-4">
      <div className="tabs items-center">
        <div className="flex min-w-0 flex-wrap gap-1" role="tablist" aria-label="Sentinel views">
          <button type="button" className="tab active" role="tab" aria-selected="true">
            Fleet
          </button>
        </div>
        <dl className="text-muted ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 px-2 text-sm">
          <div>
            Load{' '}
            <span className="text-foreground font-medium">
              {host?.load1 == null ? '-' : host.load1.toFixed(2)}
            </span>
          </div>
          <div>
            RAM{' '}
            <span className="text-foreground font-medium">
              {host?.memUsedPct == null ? '-' : `${host.memUsedPct.toFixed(0)}%`}
            </span>
          </div>
        </dl>
      </div>

      {error ? <div className="error-msg">{error}</div> : null}

      {!error && apps ? (
        apps.length === 0 ? (
          <div className="table-container glass-surface">
            <div className="table-scroll">
              <table className="fleet-table">
                <thead>
                  <tr>
                    <th className="col-status" scope="col" aria-label="Status" />
                    <th scope="col">App</th>
                    <th scope="col">CPU</th>
                    <th scope="col">RSS</th>
                    <th scope="col">ELU</th>
                    <th scope="col">Uptime</th>
                    <th scope="col">RPS</th>
                    <th scope="col">Errors</th>
                    <th scope="col">Lag p95</th>
                    <th scope="col">24h events</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={10} className="text-muted py-8 text-center text-sm">
                      No samples yet. Start the PM2 bridge on the server host, or point an in-app
                      agent at /api/ingest.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {appRows.length > 0 ? <FleetTable apps={appRows} /> : null}
            {moduleRows.length > 0 ? <FleetTable apps={moduleRows} /> : null}
          </>
        )
      ) : null}
    </div>
  );
}
