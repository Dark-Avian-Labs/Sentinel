<p align="center">
  <img src="https://raw.githubusercontent.com/Dark-Avian-Labs/.github/refs/heads/main/banner.png" alt="Dark Avian Labs">
</p>

# Sentinel

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/Sentinel/ci.yml?style=flat-square&label=CI)](https://github.com/Dark-Avian-Labs/Sentinel/actions/workflows/ci.yml)
[![PR](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/Sentinel/pr.yml?style=flat-square&label=PR)](https://github.com/Dark-Avian-Labs/Sentinel/actions/workflows/pr.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

Sentinel is the home-grown PM2 monitor for Dark Avian Labs Node apps. It watches CPU, RAM, HTTP latency, event-loop lag, and restart vs crash events on the same host that runs the fleet, then charts them over Grafana-style time ranges. Alerts and error digests stay with pm2-discord; Sentinel is the dashboard you open when you want the graphs.

## Gotchas

- Encrypted env files need `.env.keys`. Leave `VITE_*` plaintext or Vite reads ciphertext.
- `pnpm start` only loads `.env.production` when `NODE_ENV=production`.
- Ingest never stores PII. Route patterns and status classes only; no IPs, user ids, query strings, or bodies.
- Agent installs use GitHub Release tags `agent-v*`. App deploys use semantic-release `v*` and do not attach the agent tarball.

## License

MIT
