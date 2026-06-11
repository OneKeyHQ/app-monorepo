# Persistence Protocol (Confluence state/reports + Slack notify)

All durable state lives in a Confluence page tree under a fixed parent page
(`config.json` → `confluence`). Slack is notification-only. Nothing is ever
committed to the repo.

Tools:
- Confluence (claude.ai Atlassian connector): `createConfluencePage`,
  `updateConfluencePage`, `getConfluencePage`, `getConfluencePageDescendants`,
  `createConfluenceFooterComment`, `getConfluencePageFooterComments` — all
  `mcp__claude_ai_Atlassian__*`. Read/write pages with
  `contentFormat: "markdown"` for round-trip-safe JSON blocks.
- Slack (claude.ai connector): `mcp__claude_ai_Slack__slack_send_message`,
  notify-only, best-effort — a Slack failure NEVER aborts a run (state is
  already safe in Confluence); just mention it to the user.
- Codex multi-agent fallback: when the Workflow tool is not available, use
  `multi_agent_v1.spawn_agent` and `multi_agent_v1.wait_agent` for direct
  scan/refute fan-out, capped by `config.defaults.maxConcurrentAgents`.
  The main agent still owns Confluence checkpoint reconciliation and state
  transitions.

Cloud caveat: both connectors are interactively authenticated; headless runs
must have them connected. The preflight probe catches absence before any
scanning starts.

## Page tree & naming

```
<config.confluence.parentPageId>             (user-provided "folder")
└── CycleScan · <dim>                        ← STATE PAGE (edited in place)
    ├── CycleScan · <dim> · Rules v<N>       ← rules page (runtime dimensions)
    ├── CycleScan · <dim> · B001             ← BATCH PAGE
    │   │   (footer comments on this page = checkpoints)
    │   ├── CycleScan · <dim> · B001 · R001  ← run report page
    │   ├── … more run reports …
    │   └── CycleScan · <dim> · B001 · Summary
    └── CycleScan · <dim> · B002 …
```

Naming: batch/run numbers are zero-padded to 3 digits (`B001`, `R012`).
Page BODIES (reports, summaries, progress lines) are written in Chinese;
machine payloads (markers, JSON) and code identifiers stay English.

- The STATE PAGE is the single current-value store: a short human progress
  table on top, then one fenced ```json block (schema below). Every state
  change = `updateConfluencePage` with the full new body and a
  `versionMessage` like `run 3 closed · 12.4%`. Confluence page versions are
  the free audit history.
- The BATCH PAGE holds blueprint facts (pin commit, hashes, totals, suspects
  decisions). Its footer comments are the append-only checkpoint event log.
- Reports and summaries are real child pages (markdown), one per run/batch.

## Discovery and Confluence reachability

The configured parent may be a Confluence FOLDER content type, not a PAGE.
Page-only APIs can return 404 for a valid folder ID; this is a content-type
mismatch, not proof that the ID or connector is wrong. Therefore discovery
uses CQL instead: `searchConfluenceUsingCql` with
`space = <config.confluence.spaceKey> AND type = page AND title ~ "CycleScan"`
→ exact-match `CycleScan · <dim>` → state page. The state JSON then carries
page IDs (`batchPageId`, …) for targeted reads — never walk the tree during
normal operation. No state page found → dimension needs bootstrap.
(`getConfluencePageDescendants` still works on PAGES, e.g. listing a batch
page's report children in Flow A.)

Preflight rule: `getConfluencePage(config.confluence.parentPageId)` returning
404 is non-terminal when the parent is a folder. In that case, prove
Confluence reachability by CQL exact-match discovery plus a targeted
`getConfluencePage` read of the state page (when it exists). STOP before
scanning only if Confluence cannot read/write the state targets needed for the
run. For first-time bootstrap with no state page, a folder parent may still be
valid for `createConfluencePage`; if creation fails, stop and ask for a PAGE
URL or a corrected folder/page ID.

## State JSON v5 (inside the state page)

```json
{
  "v": 5,
  "dimension": "perf",
  "status": "idle | running | summarizing",
  "runnerNonce": null,
  "batch": 1,
  "batchPageId": "123456",
  "run": 1,
  "runIncomplete": false,
  "pinnedCommit": "<full sha>",
  "manifestHash": "061d4416f40e8691",
  "rulesHash": "fb9bee823985037e",
  "overrides": null,
  "rulesSource": "references/perf-rules.md | page:<pageId>",
  "totalFiles": 5623,
  "totalLines": 974632,
  "cursor": 50,
  "scannedLines": 8263,
  "summaryPageId": null,
  "prevBatchPageId": null,
  "prevSummaryPageId": null,
  "updatedAt": "2026-06-11T11:36:45Z"
}
```

- **Routing uses integers, never percentages**: batch complete iff
  `cursor >= totalFiles`. Display coverage as `scannedLines/totalLines` and
  `cursor/totalFiles`.
- `run` — current/last run number; its checkpoints are the batch-page
  comments whose marker carries `:<B>:<run>:`.
- `scannedLines` is ABSOLUTE (chunk.mjs `linesThroughProposedCursor`), never
  an increment — exact across crash recoveries.
- `summaryPageId` — null until Flow E completes (this is the
  "summary posted" routing signal). `prevBatchPageId`/`prevSummaryPageId` —
  set by Flow C when rolling batches, used for new/recurring/fixed comparison.
- `updatedAt` — `date -u +%Y-%m-%dT%H:%M:%SZ` at every update (lock heartbeat).

## Locking (one runner per dimension)

Page updates are not CAS, so the lock self-verifies:

1. Read the state page. Proceed only if `status=idle`, or staleness says the
   holder is dead (below).
2. Generate a nonce (`openssl rand -hex 4`). Update the state page:
   `status=running|summarizing`, your `runnerNonce`, `updatedAt=now`,
   everything else verbatim. versionMessage: `lock: run <R>`.
3. Wait ~5 seconds, re-read. `runnerNonce` not yours → you lost a race: STOP,
   touch nothing further.

**Staleness**: by default, the holder is dead only if BOTH are older than
`defaults.staleRunMinutes`: state `updatedAt` AND the newest checkpoint
comment for the current run (comment created-date is the clock — checkpoint
posting IS the heartbeat while a long Workflow blocks the orchestrator).
Manual takeover before the timeout is allowed only when the user explicitly
confirms in the current conversation that the prior runner has stopped. In
that case, state the current batch/run and newest checkpoint timestamp, then
lock the same run in recovery mode, collect DONE_INDICES from existing
checkpoints, and scan only the missing groups. Never increment `run` for a
manual takeover.

**Release**: every abort path after acquiring the lock MUST update the state
page back to `status=idle` (rolling back any `run` increment) before
stopping.

## Checkpoints (footer comments on the batch page)

```
[1k-cycle-scan:ckpt:<dim>:<B>:<R>:<G>]
```json
{ "g": 2, "idx": [51, 52, 60], "lines": 3716,
  "f": [ { "p": "packages/kit/src/...", "l": 120, "cat": "unbounded-concurrent-requests",
           "sev": "P1", "t": "Promise.all over all accounts without batching", "conf": 0.85 } ] }
```
run 3 · group 2/4 done · 11.8%
```

- `idx` = manifest indices of ALL files in the group (including clean ones).
- `f` = confirmed findings only (compact). Keep `t` free of angle brackets
  and bare URLs; treat any readback as potentially entity-escaped
  (`&amp; &lt; &gt;`) and unescape before parsing.
- A checkpoint asserts "these files WERE scanned". Never post one for a group
  that produced no scan result.
- Recovery/continuation must first try to preserve the interrupted run's
  original group IDs: re-run `chunk.mjs` with the same manifest, cursor, and
  `runLines/groupLines/groupFiles`, plus `--done-indices` and
  `--preserve-group-ids`. This reconstructs the original slice, emits only
  missing groups under their original marker numbers (for example, missing
  `group 9-12`), and advances the cursor only to the original slice boundary.
  The next invocation starts a normal new run for later files.
- Use a separate unused numeric range (recommended `1000 + plannedGroupId`) only
  when original group IDs cannot be reconstructed safely, e.g. config drift,
  missing pinned scripts, or already-conflicting checkpoint markers. If this
  fallback is used, say so in the report. Coverage and reconciliation are still
  based on the JSON `idx`, not the marker number.
- Read back: `getConfluencePageFooterComments` (`sort: "-created-date"`,
  paginate), filter by marker prefix for the current run.
- Crash recovery: collect `idx` from all checkpoints of the current `run`,
  replan with `chunk.mjs --done-indices --preserve-group-ids`, same run
  number.

## Reports & summary

- Run report: `createConfluencePage` (markdown body, template in playbook)
  as child of the batch page. Record nothing in state — reports are
  discoverable as batch-page children; the Slack notify carries the link.
- Batch summary: child page of the batch page; its body ENDS with a fenced
  ```json block of compact open findings (same schema as checkpoint `f`,
  plus `"st": "new"|"recurring"`) so the next batch's Flow E can read it via
  `prevSummaryPageId` without parsing prose.

## Slack notification (best-effort)

After each run close and each batch summary, send ONE line to
`config.slack.channelId`:
`perf · run 3 done · 9.6%→12.4% · P0×1 P1×4 P2×7 · <report page URL>`.
Never more than one message per run; failures are reported to the user but
never block or roll back anything.

## Preflight probes (every invocation)

1. Try `getConfluencePage` on `config.confluence.parentPageId`. Success means
   the parent is a readable PAGE.
2. If that read returns 404, treat it as a possible FOLDER and run CQL
   discovery for `CycleScan` pages in `config.confluence.spaceKey`; exact-match
   the requested state page title and read it by ID. Success means Confluence
   is reachable for existing dimensions.
3. Any non-404 auth/permission/network failure, or CQL/read failure for the
   required state target, means STOP before scanning ("state cannot be
   persisted").
4. Slack is NOT probed — it is non-critical.

## Hard rules

- Preflight before any scanning; never scan when results cannot be persisted.
- Locking and release rules are mandatory for Flows C, D, E, F.
- Post the checkpoint comment before starting the next group, not in arrears.
- Page-tree discipline: state page edited in place; checkpoints only as
  batch-page comments; reports/summaries only as child pages. No other
  artifacts.
- Targeted reads via page IDs carried in state; `getConfluencePageDescendants`
  is for discovery/bootstrap only and must stay under the fixed parent page.
