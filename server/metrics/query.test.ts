import { afterEach, describe, expect, it } from 'vitest';

import { closeMetricsDb, getMetricsDb } from './db.js';
import { coalesceLatestSampleFields, listFleet } from './query.js';
import { writeProcessSample } from './writer.js';

describe('coalesceLatestSampleFields', () => {
  it('fills status and cpu from an older PM2 row when the newest is agent-only', () => {
    const merged = coalesceLatestSampleFields([
      {
        cpu: null,
        rssMb: 144,
        lagP95Ms: 2,
        elu: 0.1,
        uptimeSec: 100,
        status: null,
      },
      {
        cpu: 0.5,
        rssMb: 140,
        lagP95Ms: null,
        elu: null,
        uptimeSec: 99,
        status: 'online',
      },
    ]);
    expect(merged).toEqual({
      cpu: 0.5,
      rssMb: 144,
      lagP95Ms: 2,
      elu: 0.1,
      uptimeSec: 100,
      status: 'online',
    });
  });
});

describe('listFleet', () => {
  afterEach(() => {
    closeMetricsDb();
  });

  it('keeps PM2 online when a newer agent sample omits status', () => {
    const db = getMetricsDb();
    const now = 1_700_000_000_000;
    writeProcessSample(db, {
      kind: 'process',
      appId: 'armory',
      displayName: 'Armory',
      pm2Name: 'Armory',
      ts: now - 5_000,
      cpu: 0.2,
      rssMb: 140,
      status: 'online',
    });
    writeProcessSample(db, {
      kind: 'process',
      appId: 'armory',
      displayName: 'Armory',
      ts: now - 1_000,
      rssMb: 144,
      lagP95Ms: 3,
      elu: 0.05,
      uptimeSec: 3600,
    });

    const [app] = listFleet(db, now);
    expect(app).toMatchObject({
      id: 'armory',
      status: 'online',
      cpu: 0.2,
      rssMb: 144,
      lagP95Ms: 3,
      elu: 0.05,
    });
  });
});
