import type Database from 'better-sqlite3';

export type FleetAppRow = {
  id: string;
  displayName: string;
  pm2Name: string | null;
  updatedAt: number;
  cpu: number | null;
  rssMb: number | null;
  lagP95Ms: number | null;
  elu: number | null;
  uptimeSec: number | null;
  status: string | null;
  lastGracefulAt: number | null;
  lastCrashAt: number | null;
  crashCount24h: number;
  restartCount24h: number;
  reqPerSec1h: number | null;
  errorRate1h: number | null;
};

export function listFleet(db: Database.Database, now = Date.now()): FleetAppRow[] {
  const since24h = now - 24 * 60 * 60 * 1000;
  const since1h = now - 60 * 60 * 1000;
  const apps = db
    .prepare(
      `SELECT id, display_name AS displayName, pm2_name AS pm2Name, updated_at AS updatedAt FROM apps ORDER BY display_name`,
    )
    .all() as Array<{ id: string; displayName: string; pm2Name: string | null; updatedAt: number }>;

  const latestSample = db.prepare(
    `SELECT cpu, rss_mb AS rssMb, lag_p95_ms AS lagP95Ms, elu, uptime_sec AS uptimeSec, status
     FROM samples_raw WHERE app_id = ? ORDER BY ts DESC LIMIT 1`,
  );
  const lastEvent = db.prepare(
    `SELECT ts FROM events WHERE app_id = ? AND kind = ? ORDER BY ts DESC LIMIT 1`,
  );
  const countEvents = db.prepare(
    `SELECT COUNT(*) AS c FROM events WHERE app_id = ? AND kind = ? AND ts >= ?`,
  );
  const http1h = db.prepare(
    `SELECT
       COALESCE(SUM(count), 0) AS total,
       COALESCE(SUM(CASE WHEN status_class IN ('4xx', '5xx') THEN count ELSE 0 END), 0) AS errors
     FROM http_raw WHERE app_id = ? AND ts >= ?`,
  );

  return apps.map((app) => {
    const sample = latestSample.get(app.id) as
      | {
          cpu: number | null;
          rssMb: number | null;
          lagP95Ms: number | null;
          elu: number | null;
          uptimeSec: number | null;
          status: string | null;
        }
      | undefined;
    const lastGraceful = lastEvent.get(app.id, 'graceful') as { ts: number } | undefined;
    const lastCrash = lastEvent.get(app.id, 'crash') as { ts: number } | undefined;
    const crashes = countEvents.get(app.id, 'crash', since24h) as { c: number };
    const restarts = countEvents.get(app.id, 'graceful', since24h) as { c: number };
    const http = http1h.get(app.id, since1h) as { total: number; errors: number };
    const reqPerSec1h = http.total > 0 ? http.total / 3600 : null;
    const errorRate1h = http.total > 0 ? http.errors / http.total : null;
    return {
      id: app.id,
      displayName: app.displayName,
      pm2Name: app.pm2Name,
      updatedAt: app.updatedAt,
      cpu: sample?.cpu ?? null,
      rssMb: sample?.rssMb ?? null,
      lagP95Ms: sample?.lagP95Ms ?? null,
      elu: sample?.elu ?? null,
      uptimeSec: sample?.uptimeSec ?? null,
      status: sample?.status ?? null,
      lastGracefulAt: lastGraceful?.ts ?? null,
      lastCrashAt: lastCrash?.ts ?? null,
      crashCount24h: crashes.c,
      restartCount24h: restarts.c,
      reqPerSec1h,
      errorRate1h,
    };
  });
}

export type RangePreset = '1h' | '6h' | '24h' | '7d' | '30d' | 'today';

export function resolveRange(
  preset: RangePreset,
  now = Date.now(),
): { from: number; to: number; table: 'raw' | '1m' | '1h'; bucketMs: number } {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const spans: Record<RangePreset, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    today: now - dayStart.getTime(),
  };
  const span = spans[preset];
  const from = preset === 'today' ? dayStart.getTime() : now - span;
  let table: 'raw' | '1m' | '1h' = 'raw';
  let bucketMs = 60_000;
  if (span > 48 * 60 * 60 * 1000) {
    table = '1h';
    bucketMs = 3_600_000;
  } else if (span > 6 * 60 * 60 * 1000) {
    table = '1m';
    bucketMs = 60_000;
  } else {
    bucketMs = 60_000;
  }
  return { from, to: now, table, bucketMs };
}

export type SeriesPoint = {
  ts: number;
  cpu: number | null;
  rssMb: number | null;
  heapMb: number | null;
  heapTotalMb: number | null;
  heapExternalMb: number | null;
  lagP95Ms: number | null;
  elu: number | null;
  uptimeSec: number | null;
  gcP95Ms: number | null;
};

export function querySeries(
  db: Database.Database,
  appId: string,
  preset: RangePreset,
  now = Date.now(),
): SeriesPoint[] {
  const { from, to, table } = resolveRange(preset, now);
  if (table === 'raw') {
    return db
      .prepare(
        `SELECT ts, cpu, rss_mb AS rssMb, heap_mb AS heapMb, heap_total_mb AS heapTotalMb,
                heap_external_mb AS heapExternalMb, lag_p95_ms AS lagP95Ms, elu,
                uptime_sec AS uptimeSec, gc_p95_ms AS gcP95Ms
         FROM samples_raw WHERE app_id = ? AND ts >= ? AND ts <= ? ORDER BY ts`,
      )
      .all(appId, from, to) as SeriesPoint[];
  }
  if (table === '1m') {
    return db
      .prepare(
        `SELECT bucket_ts AS ts, cpu_avg AS cpu, rss_avg AS rssMb, heap_avg AS heapMb,
                heap_total_avg AS heapTotalMb, heap_external_avg AS heapExternalMb,
                lag_p95_avg AS lagP95Ms, elu_avg AS elu, NULL AS uptimeSec, gc_p95_avg AS gcP95Ms
         FROM samples_1m WHERE app_id = ? AND bucket_ts >= ? AND bucket_ts <= ? ORDER BY bucket_ts`,
      )
      .all(appId, from, to) as SeriesPoint[];
  }
  return db
    .prepare(
      `SELECT bucket_ts AS ts, cpu_avg AS cpu, rss_avg AS rssMb, heap_avg AS heapMb,
              heap_total_avg AS heapTotalMb, heap_external_avg AS heapExternalMb,
              lag_p95_avg AS lagP95Ms, elu_avg AS elu, NULL AS uptimeSec, gc_p95_avg AS gcP95Ms
       FROM samples_1h WHERE app_id = ? AND bucket_ts >= ? AND bucket_ts <= ? ORDER BY bucket_ts`,
    )
    .all(appId, from, to) as SeriesPoint[];
}

export type HttpPoint = {
  ts: number;
  count: number;
  latencyP95Ms: number | null;
  reqPerSec: number | null;
  errorRate: number | null;
};

export function queryHttpSeries(
  db: Database.Database,
  appId: string,
  preset: RangePreset,
  now = Date.now(),
): HttpPoint[] {
  const { from, to, bucketMs } = resolveRange(preset, now);
  const rows = db
    .prepare(
      `SELECT
         (ts / ?) * ? AS ts,
         SUM(count) AS count,
         AVG(latency_p95_ms) AS latencyP95Ms,
         SUM(CASE WHEN status_class IN ('4xx', '5xx') THEN count ELSE 0 END) AS errors
       FROM http_raw
       WHERE app_id = ? AND ts >= ? AND ts <= ?
       GROUP BY (ts / ?) * ?
       ORDER BY ts`,
    )
    .all(bucketMs, bucketMs, appId, from, to, bucketMs, bucketMs) as Array<{
    ts: number;
    count: number;
    latencyP95Ms: number | null;
    errors: number;
  }>;

  const bucketSec = bucketMs / 1000;
  return rows.map((row) => ({
    ts: row.ts,
    count: row.count,
    latencyP95Ms: row.latencyP95Ms,
    reqPerSec: bucketSec > 0 ? row.count / bucketSec : null,
    errorRate: row.count > 0 ? row.errors / row.count : null,
  }));
}

export type EventRatePoint = {
  ts: number;
  graceful: number;
  crash: number;
};

export function queryEventRates(
  db: Database.Database,
  appId: string,
  preset: RangePreset,
  now = Date.now(),
): EventRatePoint[] {
  const { from, to, bucketMs } = resolveRange(preset, now);
  return db
    .prepare(
      `SELECT
         (ts / ?) * ? AS ts,
         SUM(CASE WHEN kind = 'graceful' THEN 1 ELSE 0 END) AS graceful,
         SUM(CASE WHEN kind = 'crash' THEN 1 ELSE 0 END) AS crash
       FROM events
       WHERE app_id = ? AND ts >= ? AND ts <= ?
       GROUP BY (ts / ?) * ?
       ORDER BY ts`,
    )
    .all(bucketMs, bucketMs, appId, from, to, bucketMs, bucketMs) as EventRatePoint[];
}

export type EventRow = {
  id: number;
  ts: number;
  kind: string;
  exitCode: number | null;
  signal: string | null;
  message: string | null;
  source: string;
};

export function queryEvents(
  db: Database.Database,
  appId: string,
  preset: RangePreset,
  now = Date.now(),
): EventRow[] {
  const { from, to } = resolveRange(preset, now);
  return db
    .prepare(
      `SELECT id, ts, kind, exit_code AS exitCode, signal, message, source
       FROM events
       WHERE app_id = ? AND ts >= ? AND ts <= ?
       ORDER BY ts DESC
       LIMIT 200`,
    )
    .all(appId, from, to) as EventRow[];
}

export type HostPoint = {
  ts: number;
  load1: number | null;
  load5: number | null;
  memUsedPct: number | null;
};

export function queryHostSeries(
  db: Database.Database,
  preset: RangePreset,
  now = Date.now(),
): HostPoint[] {
  const { from, to } = resolveRange(preset, now);
  return db
    .prepare(
      `SELECT ts, load1, load5, mem_used_pct AS memUsedPct
       FROM host_raw WHERE ts >= ? AND ts <= ? ORDER BY ts`,
    )
    .all(from, to) as HostPoint[];
}

export function getLatestHost(db: Database.Database): HostPoint | null {
  const row = db
    .prepare(
      `SELECT ts, load1, load5, mem_used_pct AS memUsedPct
       FROM host_raw ORDER BY ts DESC LIMIT 1`,
    )
    .get() as HostPoint | undefined;
  return row ?? null;
}

export function getAppMeta(
  db: Database.Database,
  appId: string,
): { id: string; displayName: string; pm2Name: string | null } | null {
  const row = db
    .prepare(`SELECT id, display_name AS displayName, pm2_name AS pm2Name FROM apps WHERE id = ?`)
    .get(appId) as { id: string; displayName: string; pm2Name: string | null } | undefined;
  return row ?? null;
}
