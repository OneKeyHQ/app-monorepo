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
└── CycleScan · <dim>                        ← STATE PAGE (edited in place; LOCKED flows only)
    ├── CycleScan · <dim> · Rules v<N>       ← rules page (runtime dimensions)
    ├── CycleScan · <dim> · B001             ← BATCH PAGE
    │   │   (body = blueprint + run table; footer comments = run-closed
    │   │    index + batch fence — NEVER checkpoints)
    │   ├── CycleScan · <dim> · B001 · R001  ← RUN PAGE (pre-created by Flow C)
    │   │     (body: placeholder → run report at close; footer comments =
    │   │      THIS run's claim / checkpoints / close / void)
    │   ├── … R002 … one page per planned run …
    │   └── CycleScan · <dim> · B001 · Summary
    └── CycleScan · <dim> · B002 …
```

Naming: batch/run numbers are zero-padded to 3 digits (`B001`, `R012`).
Page BODIES (reports, summaries, progress lines) are written in Chinese;
machine payloads (markers, JSON) and code identifiers stay English.

- The STATE PAGE is the single current-value store: a short human progress
  snapshot on top, then one fenced ```json block (schema below). **Only flows
  holding the batch-level state lock (B/C/E/F) may write it; Flow D runners
  never do.** Page updates are full-body overwrites with no CAS — one stray
  write from a parallel runner can erase another flow's lock or roll routing
  fields back to a stale snapshot. Live mid-batch progress is therefore
  derived from the run-closed index, not from this page; its progress
  snapshot refreshes whenever a locked flow runs. Every state write uses
  `updateConfluencePage` with the full new body and a `versionMessage`
  (page versions are the free audit history).
- The BATCH PAGE body holds blueprint facts (pin commit, hashes, totals,
  suspects decisions) plus the run table. Its footer comments carry ONLY the
  run-closed index (one best-effort entry per closed run) and the batch fence
  — a deliberately small stream that one comments page can usually hold
  (EXCEPT batches retrofitted from v5, whose legacy checkpoints share this
  stream — paginate to exhaustion there; see Migration).
- RUN PAGES are pre-created with a placeholder body when the batch opens. All
  of one run's lifecycle comments live on its own page (~1 claim + ~13
  checkpoints + 1 close ≈ 15 comments), so claim arbitration never depends on
  deep pagination. At close, the body is REPLACED with the run report via
  `updateConfluencePage` — the page already exists, so there is no
  create-page/title-collision path.
- The batch summary is a real child page of the batch page.

## Discovery and Confluence reachability

The configured parent may be a Confluence FOLDER content type, not a PAGE.
Page-only APIs can return 404 for a valid folder ID; this is a content-type
mismatch, not proof that the ID or connector is wrong. Therefore discovery
uses CQL instead: `searchConfluenceUsingCql` with
`space = <config.confluence.spaceKey> AND type = page AND title ~ "CycleScan"`
→ exact-match `CycleScan · <dim>` → state page. The state JSON and run table
then carry page IDs (`batchPageId`, run `pageId`s, …) for targeted reads —
never walk the tree during normal operation. No state page found → dimension
needs bootstrap. (`getConfluencePageDescendants` still works on PAGES, e.g.
listing a batch page's children in Flow A.)

Preflight rule: `getConfluencePage(config.confluence.parentPageId)` returning
404 is non-terminal when the parent is a folder. In that case, prove
Confluence reachability by CQL exact-match discovery plus a targeted
`getConfluencePage` read of the state page (when it exists). STOP before
scanning only if Confluence cannot read/write the state targets needed for the
run. For first-time bootstrap with no state page, a folder parent may still be
valid for `createConfluencePage`; if creation fails, stop and ask for a PAGE
URL or a corrected folder/page ID.

## State JSON v6 (inside the state page)

```json
{
  "v": 6,
  "dimension": "perf",
  "status": "idle | opening | summarizing | rebuilding",
  "runnerNonce": null,
  "batch": 2,
  "batchPageId": "123456",
  "pinnedCommit": "<full sha>",
  "manifestHash": "061d4416f40e8691",
  "rulesHash": "fb9bee823985037e",
  "overrides": null,
  "rulesSource": "references/perf-rules.md | page:<pageId>",
  "totalFiles": 5435,
  "totalLines": 949156,
  "runCount": 19,
  "runLines": 50000,
  "legacyCursor": 0,
  "summaryPageId": null,
  "prevBatchPageId": null,
  "prevSummaryPageId": null,
  "updatedAt": "2026-06-12T08:00:00Z"
}
```

- `status`/`runnerNonce` form the batch-level lock, used ONLY by Flows
  B/C/E/F. v5's run-level fields (`cursor`, `run`, `runIncomplete`,
  `scannedLines`, `status=running`) are gone: per-run state lives on run
  pages; progress is derived from the run-closed index.
- `runCount`/`runLines` describe the run table; the authoritative copy with
  boundaries and page IDs is in the batch page body.
- `legacyCursor` — 0 normally. For batches retrofitted from v5, files
  `[0, legacyCursor)` were covered by pre-v6 sequential runs (their
  checkpoints remain as batch-page comments; see Migration).
- Routing uses `batch`, `summaryPageId`, and the run-closed index — never
  percentages. Batch complete iff every table run is closed with empty
  `missingIdx`.
- `updatedAt` — `date -u +%Y-%m-%dT%H:%M:%SZ` at every state write (heartbeat
  for the batch-level lock).
- `summaryPageId` — null until Flow E completes ("summary posted" routing
  signal). `prevBatchPageId`/`prevSummaryPageId` — set by Flow C when rolling
  batches, used for new/recurring/fixed comparison.
- **Initial state (Flow B, batch=0)**: every field above MUST be present.
  `status="idle"`, `runnerNonce=null`, `batch=0`, `batchPageId=null`,
  `pinnedCommit=null`, `manifestHash=null`, `rulesHash=null`,
  `totalFiles=0`, `totalLines=0`, `runCount=0`, `runLines=0`,
  `legacyCursor=0`, `summaryPageId=null`, `prevBatchPageId=null`,
  `prevSummaryPageId=null`, `updatedAt=now`; `overrides`/`rulesSource` as
  resolved by bootstrap.
- **Version guard**: every locked flow asserts `"v": 6` when it reads the
  state page AND re-checks it before writing. Finding the JSON reverted to
  `"v": 5` (a woken pre-migration runner overwrote the page) → STOP and tell
  the user to restore via the state page's version history — never run a
  second automatic retrofit on top.
- `manifestHash`/`rulesHash` come from `manifest.mjs` stdout — `rulesHash`
  hashes the manifest GENERATION rules (globs/excludes), not the dimension's
  scan checklist. Never compute either by hashing files yourself.

## Run table (batch page body)

```json
{ "runLines": 50000, "firstRun": 1, "runs": [
  { "r": 1, "start": 0,  "end": 53,  "files": 53, "lines": 50214, "pageId": "182521..." },
  { "r": 2, "start": 53, "end": 107, "files": 54, "lines": 50090, "pageId": "182522..." }
] }
```

Deterministic output of `chunk.mjs --plan-runs` against the pinned manifest.
Boundaries use the exact accumulation rule of normal slicing, so
`chunk.mjs --cursor <start> --lines <runLines>` reproduces each run verbatim
at execution time — the runner asserts `proposedCursor == end`; a mismatch
means drift (wrong manifest/scripts/config) → void the claim and stop.
Written once by Flow C under the state lock (including the pageId fill-in
pass) and never edited afterwards.

## Locking — two levels

**Batch-level state lock (Flows B/C/E/F)** — page updates are not CAS, so the
lock self-verifies:

1. Read the state page. Proceed only if `status=idle`, or the holder is dead:
   `updatedAt` older than `defaults.staleRunMinutes`.
2. Generate a nonce (`openssl rand -hex 4`). Update the state page:
   `status=opening|summarizing|rebuilding`, your `runnerNonce`,
   `updatedAt=now`, everything else verbatim. versionMessage: `lock: <flow>`.
3. Wait ~5 seconds, re-read. `runnerNonce` not yours → you lost a race: STOP,
   touch nothing further.

Every abort path after acquiring this lock MUST restore `status=idle` before
stopping.

**Run-level claims (Flow D)** — comment-based, on the RUN page. The lock
scope is the single run: an in-progress run (live heartbeat) or a run whose
staleness window has not elapsed simply cannot be claimed; every other run
stays claimable in parallel.

> **Engine rule — no hand evaluation.** Ownership, pickability, staleness,
> circuit breakers, Slack dedup, completeness, progress, comment bodies, and
> state transitions are ALL computed by `scripts/coordinate.mjs`. The model's
> job is I/O only: dump comments to JSON (paginate to exhaustion), run the
> op, execute the returned instructions verbatim. The prose below is the
> spec the engine implements (kept for humans and reviewers); when in doubt,
> the engine's output wins. Comment bodies are generated with
> `--op make-comment` — never hand-format markers or payload JSON.

```
[1k-cycle-scan:claim:<dim>:<B>:<R>]
{"nonce":"ab12cd34","mode":"scan|repair|takeover","groupLines":4000,"groupFiles":25,"focus":null,"at":"2026-06-12T08:00:00Z"}

[1k-cycle-scan:close:<dim>:<B>:<R>]
{"nonce":"ab12cd34","missingIdx":[],"waivedIdx":[],"lines":50214,"at":"..."}

[1k-cycle-scan:void:<dim>:<B>:<R>]
{"nonce":"ab12cd34","reason":"manifest hash mismatch","at":"..."}
```

A run is **pickable** (per `--op run-status`) as:
- `scan` — the run page has no claim comments at all;
- `repair` — the newest close has non-empty `missingIdx` and there is no
  newer claim. Allowed IMMEDIATELY, no staleness wait — the closer explicitly
  gave up on those groups;
- `voided` — the owner posted `void` and there is no newer claim/close.
  Allowed IMMEDIATELY — a voluntary void never freezes the run;
- `takeover` — the newest claim's owner is dead: the newest of (that claim,
  its nonce-matched checkpoints) is older than `defaults.staleRunMinutes`.
  Manual takeover before the timeout is allowed only when the user explicitly
  confirms in the current conversation that the prior runner has stopped —
  state the run and its newest checkpoint timestamp first.
- NEVER pickable: a run whose newest close has empty `missingIdx` (complete,
  including waiver closes). Such a run is terminal; later claims never take
  ownership, no matter how old the heartbeat looks.

Circuit breakers (engine-enforced, `pickable` becomes `none`):
- `repairBreaker` — two consecutive closes carry the SAME `missingIdx`.
  Options to surface to the user: the orchestrator scans the failing group
  itself in-session; a user-confirmed WAIVER close (`missingIdx:[]` +
  `waivedIdx:[...]` — counts complete, waived files listed in the summary);
  exclude the file via next-batch `overrides`; Flow F rebuild as last resort.
- `voidBreaker` — two consecutive voids with the same reason (systemic
  failure, e.g. table drift). Report and stop; do not burn more sessions.

Claim procedure:
1. Finish ALL preflight (pinned tree, manifest rebuild, hash assertions)
   BEFORE posting any claim — keep the claim-to-abort window minimal.
2. Dump the candidate run page's comments; `--op run-status` says whether and
   how it is pickable.
3. Post the claim comment (`--op make-comment --kind claim`, fresh
   `openssl rand -hex 4` nonce). For `repair`/`takeover`, copy
   `groupLines`/`groupFiles`/`focus` from `originalClaim` in the run-status
   output (the owning claim that produced the existing checkpoints) — never
   from your own session config.
4. Wait ~10 seconds; re-dump, re-run `run-status --my-nonce <nonce>`.
   `ownedByMe=false` → you lost the race: post `void` (courtesy), move on to
   another run.
5. While scanning, checkpoint comments are the heartbeat (they carry your
   nonce).
6. Before closing (and during reconciliation), re-dump + `run-status`:
   `ownedByMe=false` means you went stale and were taken over → STOP
   silently — no report write, no close, no Slack.

**Ownership fold** (the spec `run-status` implements): walk claim comments
oldest → newest. The first claim owns the run. Each later claim takes
ownership ONLY if, judged against the comments created before it, the run
was then pickable (owner stale / voided / incomplete-closed) — and never
after a complete close. When two claims race for the same predecessor state,
the earlier created-date wins; same-second ties → smaller nonce string. A
claim that never took ownership is void whether or not its tombstone exists —
correctness never depends on losers cleaning up after themselves.

**Release (claim edition)**: after posting a claim, EVERY abort path must
post `void` before exiting. A missing void freezes only that one run until
its staleness window passes — never the batch; other runners keep claiming
other runs.

## Checkpoints (footer comments on the RUN page)

```
[1k-cycle-scan:ckpt:<dim>:<B>:<R>:<G>]
```json
{ "g": 2, "idx": [51, 52, 60], "lines": 3716, "nonce": "ab12cd34",
  "f": [ { "p": "packages/kit/src/...", "l": 120, "cat": "unbounded-concurrent-requests",
           "sev": "P1", "t": "Promise.all over all accounts without batching", "conf": 0.85 } ] }
```
run 5 · group 2/13 done
```

- `nonce` = the posting runner's claim nonce. Heartbeat/staleness attribution
  is nonce-matched, so a woken pre-takeover runner's late checkpoints never
  extend the new owner's liveness.
- `idx` = manifest indices of ALL files in the group (including clean ones).
- `f` = confirmed findings only (compact). Keep `t` free of angle brackets
  and bare URLs; treat any readback as potentially entity-escaped
  (`&amp; &lt; &gt;`) and unescape before parsing.
- A checkpoint asserts "these files WERE scanned". Never post one for a group
  that produced no scan result.
- Repair/takeover must first try to preserve the interrupted run's original
  group IDs: take `doneIndices` and `originalClaim` from `run-status`, then
  re-run `chunk.mjs` with the same manifest, `--repo <pinned worktree>`,
  `--cursor <run.start>`, `--lines <table.runLines>`, the ORIGINAL claim's
  `groupLines`/`groupFiles`, plus `--done-indices` and
  `--preserve-group-ids`; assert the reconstructed
  `proposedCursor == run.end`. This emits only missing groups under their
  original marker numbers.
- Use a separate unused numeric range (recommended `1000 + plannedGroupId`)
  only when original group IDs cannot be reconstructed safely, e.g. config
  drift, missing pinned scripts, or already-conflicting checkpoint markers.
  Recipe: the same `--cursor <run.start> --lines <table.runLines>
  --done-indices … --preserve-group-ids` call, but with your session's
  `groupLines`/`groupFiles`; renumber the emitted group IDs by +1000 for the
  checkpoint markers. If this fallback is used, say so in the report.
  Coverage and reconciliation are still based on the JSON `idx`, not the
  marker number.
- Read back: `getConfluencePageFooterComments` on the RUN page
  (`sort: "-created-date"`, paginate to exhaustion).

## Close & the run-closed index

Order, after the ownership recheck (step 6 above):
1. Run page body ← the run report (`updateConfluencePage`, template in
   playbook). Findings come from `run-status.findings` — ALL checkpoints on
   the run page, not just the groups you scanned yourself (a takeover report
   must include the dead runner's groups too).
2. Run page close comment — AUTHORITATIVE (`make-comment --kind close`).
   `missingIdx` non-empty = incomplete close: those files are still owed; the
   run is immediately repair-pickable, and the human line says 部分完成, not
   完成. `waivedIdx` is set only on a user-confirmed waiver close. `lines` =
   lines actually covered.
3. Batch page index comment (`make-comment --kind run-closed`) — best-effort:
   ```
   [1k-cycle-scan:run-closed:<dim>:<B>:<R>]
   {"missingIdx":[],"lines":50214}
   R005 已关 · 8/19 · 已覆盖 41.2% 行
   ```
   Failure is non-fatal: the run page close is what counts; a reader missing
   an index entry for a run must fall back to reading that run page before
   concluding anything. Conversely, a probe that reveals a complete close
   with NO index entry should re-post the index comment (best-effort repair)
   so later sessions skip the probe.
4. Slack notify (best-effort). Dedup: skip iff `run-status.slackDedup` is
   true — i.e. a COMPLETE close already existed before yours (takeover
   replay). A repair that completes a previously-incomplete run DOES notify
   (the earlier 部分完成 line was not a completion).

**Batch completeness** (the Flow E gate): every table run has a close with
empty `missingIdx`. The index is the cheap first read; before Flow E starts,
completeness MUST be verified authoritatively: dump every table run page's
comments into a directory (`r<NNN>.json`) and run `--op batch-status`.
`legacyCursor` files count as covered by definition.

Progress display everywhere: `closed runs/runCount` and
`covered lines/totalLines`, from `pick-order`/`batch-status` `progress`
(legacy runs count as closed; legacy lines are covered by definition but not
in the table — display them from the v5 snapshot when exactness matters).

## Batch fence

Flow F (rebuild) posts on the ABANDONED batch page, under the state lock:

```
[1k-cycle-scan:batch-closed:<dim>:<B>]
{"reason":"forcedRebuild","at":"..."}
```

Claimers must (a) re-read the state page right before picking and verify
`batchPageId` matches the batch they are about to claim on, and (b) treat a
`batch-closed` comment in the index as a hard stop: local state is stale —
re-read everything (`pick-order` enforces this when the fence is in the
dump). A runner already mid-run on a fenced batch merely wastes that slice;
it only ever writes its own run page, which is harmless — but if the close-
time batch-page read shows the fence, skip the index comment and Slack (the
batch is dead; keep only the run page close for the record). Flow C needs no
fence: it only opens a new batch after the old one is fully closed and
summarized, when no run is pickable by construction.

## Page creation idempotency

Confluence enforces unique titles per space, and structural flows create
pages BEFORE the state update that records them (Flow C: batch + run pages;
Flow B: state + rules pages; Flow E: summary page; migration: run pages). A
crash between create and record means the retry MUST NOT blindly create:
on a title-conflict error — or, cheaper, before creating — look the title up
with exact-match CQL; if the page exists under the correct parent, ADOPT it
(reuse its ID, refresh its body if needed) and continue. Title conflicts are
always a resume signal, never an error to improvise around.

## Reports & summary

- Run report: the RUN PAGE BODY, replacing the placeholder at close — never a
  new page. Run pages are discoverable from the run table; the Slack notify
  carries the link.
- Batch summary: child page of the batch page; its body ENDS with a fenced
  ```json block of compact open findings (same schema as checkpoint `f`,
  plus `"st": "new"|"recurring"`) so the next batch's Flow E can read it via
  `prevSummaryPageId` without parsing prose.

## Slack notification (best-effort)

`config.slack.notify=false` disables ALL Slack notifications. Otherwise,
after each run close and each batch summary, send ONE line to
`config.slack.channelId`:
`perf · B002 R005 完成 · 范围 [250,300) · P0×1 P1×4 P2×7 · 已关 8/19 · <run page URL>`.
An incomplete close says `部分完成 · 缺 <n> 文件` instead of `完成`. Never
more than one completion message per run (dedup = `run-status.slackDedup`);
failures are reported to the user but never block or roll back anything.

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

## Migration v5 → v6 (one-time, per dimension)

A runner reading `"v": 5` MUST NOT scan; retrofit first, under the state lock
(`status=opening`):

1. The v5 state must be quiescent: `status=idle`, or stale per v5's rule
   (state `updatedAt` AND newest current-run checkpoint both older than
   `staleRunMinutes`). ADDITIONALLY, the user must confirm in the current
   conversation that no v5 session may still be alive (state the v5
   `updatedAt` and newest checkpoint timestamps) — a v5 runner waking AFTER
   the retrofit would blindly overwrite the state page back to v5; the
   version guard makes every later v6 flow STOP and point at the page's
   version history instead of re-retrofitting. If `runIncomplete=true`, the
   interrupted run's partial progress past `cursor` will simply be rescanned
   by the new table — tell the user.
2. Plan the remainder:
   `chunk.mjs --manifest … --cursor <v5.cursor> --lines <config.defaults.runLines>
   --plan-runs --first-run <v5.run + 1>` (numbering continues, so legacy run
   report pages keep their titles).
3. Append the run-table JSON block to the batch page body; pre-create the run
   pages (placeholder bodies; idempotency rule applies on retry).
4. Rewrite the state JSON via `coordinate.mjs --op state --transition
   retrofit --state <v5.json> --table <runs.json>` (sets `legacyCursor`,
   `runCount = v5.run + table runs`, drops the v5-only fields), then
   `status=idle`.
5. Legacy checkpoints stay where they are (batch page comments). Flow E for a
   retrofitted batch collects findings from the batch page comments (legacy
   runs) AND every run page (table runs). NOTE: this makes a retrofitted
   batch page's comment stream LARGE — every batch-page comment read on such
   a batch must paginate to exhaustion, same discipline as run pages.

## Hard rules

- Preflight before any scanning; never scan when results cannot be persisted.
- ALL protocol decisions go through `scripts/coordinate.mjs` (run-status /
  pick-order / batch-status / make-comment / state / route). Never
  hand-evaluate ownership, pickability, staleness, completeness, or
  state transitions; never hand-format protocol comments. Dumps fed to the
  engine must include EVERY comment page (paginate to exhaustion).
- The state page is written ONLY under the batch-level lock (Flows B/C/E/F);
  Flow D never writes it. State bodies come from `--op state` transitions
  (which enforce the v6 version guard).
- Never scan without owning the run's claim; re-verify ownership before
  closing. An in-progress run or a run still inside its staleness window is
  not claimable — the lock scope is the run, not the batch.
- Post the checkpoint comment before starting the next group, not in arrears.
- Page-tree discipline: claims/checkpoints/closes/voids only on the claimed
  RUN page; index/fence comments only on the BATCH page; state page edited in
  place; summaries only as child pages. No other artifacts.
- Page creation is idempotent: title conflict ⇒ CQL exact-match lookup ⇒
  adopt the existing page; never improvise a new title.
- Targeted reads via page IDs carried in the state JSON and run table;
  `getConfluencePageDescendants` is for discovery/bootstrap only and must
  stay under the fixed parent page.
