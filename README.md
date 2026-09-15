# n8n-nodes-getmulticast

An [n8n](https://n8n.io) community node for [GetMulticast](https://getmulticast.com) —
publish posts, manage the AI-drafted reply review queue, and configure webhooks/RSS
auto-post feeds, all against the real, documented
[GetMulticast API](https://getmulticast.com/api-docs.html).

## Install (self-hosted n8n)

**Community Nodes (recommended):** n8n → Settings → Community Nodes → Install →
enter `n8n-nodes-getmulticast` (once published to npm — see "Publishing" below).

**Manual install**, if you're testing this before it's published:
```
cd /path/to/n8n-nodes-getmulticast
npm install
npm run build   # compiles TypeScript -> dist/, which is what n8n actually loads
cd ~/.n8n/nodes   # or wherever your n8n instance looks for custom nodes
npm install /path/to/n8n-nodes-getmulticast
```
Restart n8n.

## Credentials

Create one at **getmulticast.com → Settings → Developer → New API key**, then add a
"GetMulticast API" credential in n8n with that key.

## Receiving events — GetMulticast Trigger node

This package ships a real **GetMulticast Trigger** node with automatic webhook
lifecycle management — no manual URL-copying step. Add it to a workflow, pick which
events should start it (`post.published`, `post.failed`, `comment.received`,
`reply.sent`), and activate the workflow:

- **Activating** the workflow calls `POST /webhooks` for you, registering n8n's own
  webhook URL and capturing the one-time delivery secret into the workflow's
  encrypted static data.
- Every delivery is **signature-verified** (`X-GetMulticast-Signature`, HMAC-SHA256)
  before it reaches your workflow — a forged or corrupted delivery is rejected with
  a 401, never passed through.
- **Deactivating** the workflow calls `DELETE /webhooks/{id}` for you, cleaning up
  the registration automatically.

(The plain n8n **Webhook** node still works too, if you'd rather register the URL
yourself via this package's Webhook → Register action or the GetMulticast dashboard
— the Trigger node is the more complete option, not the only one.)

## What it can do

**GetMulticast** (action node) resources: Video, Post, Comment, Pending Reply, Webhook,
RSS Feed, Recycling Rule, Account, Credits — see the
[API reference](https://getmulticast.com/api-docs.html) for exact parameters; every
operation maps to one documented endpoint there. Recycling Rule automatically
re-publishes one of your own already-published posts every N days, optionally with
an AI-rewritten caption each time.

**Video** (Create/Get/List/Delete) generates a real AI video — same engine as the
dashboard's own Generate Video button — the same role Blotato's "Visual" resource
plays in their node. Typical flow: **Video > Create** (a prompt, optionally AI
voiceover) → poll **Video > Get** until `status` is `"ready"` → feed the resulting
`videoUrl` straight into **Post > Create** or **Post > Schedule**. Pair this with a
Telegram trigger node and a manual-approval step in between to build the same
"idea in Telegram → AI video → approve → publish everywhere" flow Blotato's own n8n
templates demonstrate. Honest note: this is a secondary, best-effort capability, not
GetMulticast's core purpose — it runs on one free provider (Agnes) that can
occasionally fail or queue up, unlike Blotato's paid, production-grade video models.
GetMulticast's primary role, like Buffer's, is scheduling and managing posts across
multiple social platforms — Video is a bonus on top of that, not the main feature.

**GetMulticast Trigger** (trigger node): starts a workflow on any of the 4 real
GetMulticast events, with the lifecycle described above.

## Publishing this package (for maintainers)

Written in TypeScript specifically to qualify for n8n's **Verified** community node
program — see [n8n's verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines)
for the full list this package is built to satisfy (TypeScript, no runtime
dependencies, no env var/file access, MIT license, English-only, etc.).

**Local dev checks** (all pass as of this writing):
```
npm install
npm run build   # tsc compile + copy node icons into dist/
npm run lint    # ESLint against n8n's TypeScript rules
```

**Publishing itself must happen via GitHub Actions with npm provenance** — n8n
explicitly does not accept verified nodes published from a local machine. See
`.github/workflows/publish.yml`: it builds, lints, runs n8n's own
`@n8n/scan-community-package` scanner, then `npm publish --provenance` — triggered by
pushing a `v*.*.*` git tag. Requirements before that workflow can run for real:

1. This package needs to live in its own **public GitHub repository** (matching the
   `repository.url` in `package.json` — update that placeholder once the real repo
   exists).
2. An **`NPM_TOKEN` secret** on that GitHub repo, from an npm account with publish
   rights to the `n8n-nodes-getmulticast` name (the name is currently unclaimed).
3. After the first successful publish, submit the package through n8n's
   [Creator Portal](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes)
   for their review — verification is a human decision on their side, not automatic
   just because the workflow runs clean.

Note: `@n8n/scan-community-package` (and n8n's own `@n8n/node-cli` scaffolding tool)
require Node.js ≥22 — they use `isolated-vm`, which fails to build on Node 20. The
GitHub Actions workflow pins Node 22 for exactly this reason; a contributor testing
locally on an older Node version can still run `npm run build`/`npm run lint`
(no Node-version issue there), just not the official scanner itself.
