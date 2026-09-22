# @dark-avian-labs/sentinel-agent

In-process agent for Sentinel. Collects event-loop lag, HTTP latency by route pattern, and graceful vs crash exit events. Never sends IPs, user ids, query strings, cookies, or bodies.

## Install

Local iteration:

```json
"@dark-avian-labs/sentinel-agent": "file:../Sentinel/packages/agent"
```

Production / pinned: download the packed tarball from a GitHub Release tagged `agent-vX.Y.Z` (not the app `v*` releases from CI semantic-release):

```json
"@dark-avian-labs/sentinel-agent": "https://github.com/Dark-Avian-Labs/Sentinel/releases/download/agent-v0.1.0/dark-avian-labs-sentinel-agent-0.1.0.tgz"
```

Create a release with Actions → **Agent Release** (`workflow_dispatch`), or publish a GitHub Release whose tag starts with `agent-v`.

## Usage

```ts
import { createSentinelAgent } from '@dark-avian-labs/sentinel-agent';

const agent = createSentinelAgent({
  appId: 'outfitter',
  displayName: 'Outfitter',
  ingestUrl: 'http://127.0.0.1:3005/api/ingest',
  token: process.env.SENTINEL_INGEST_TOKEN!,
});

app.use(agent.middleware);
agent.start();

process.on('SIGTERM', () => {
  agent.noteGracefulExit('SIGTERM');
  // then your existing shutdown
});
process.on('uncaughtException', (err) => {
  agent.noteCrash(err);
});
```
