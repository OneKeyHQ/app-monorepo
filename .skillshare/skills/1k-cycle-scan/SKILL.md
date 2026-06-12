---
name: 1k-cycle-scan
description: Recurring, resumable whole-repo scan harness. Sweeps the OneKey monorepo in batches across configurable dimensions (performance, security, custom), pre-slicing each batch into a fixed run table that parallel sessions claim run-by-run (per-run locking), with exact per-file coverage tracking, Confluence-persisted state/checkpoints/reports, a code-reviewed batch summary, and one-line Slack notifications. Manual-only — never auto-invoked; trigger explicitly via /1k-cycle-scan <dimension>.
disable-model-invocation: true
---

# 1k-cycle-scan — recurring whole-repo scan

Finds issues; never fixes or cleans anything. Output is reports only.

**Core model**: a *dimension* (perf / security / custom checklist) is scanned
in *batches*. A batch pins one commit of `origin/x`, builds a deterministic
file blueprint from it, and pre-slices it into a fixed *run table* (default
50k lines per run, `chunk.mjs --plan-runs`); every planned run gets its own
pre-created Confluence run page. One invocation = pick an idle run, claim it
via a comment on its run page, fan out scan agents over ~4k-line *groups*
(checkpoint after every group, on the run page), and close it by writing the
report into the run page body. **Runs execute in parallel**: locking is
per-run, not per-batch — multiple sessions each claim a different run; ranges
never overlap by construction. An in-progress run (live heartbeat) or a run
still inside its staleness window is simply not claimable. When all runs are
closed, a code-reviewed batch summary closes the batch; the next invocation
re-pins latest `origin/x` and opens the next batch.

**Persistence**: everything lives in a Confluence page tree under a fixed
parent page (claude.ai Atlassian connector). Per dimension: a STATE PAGE
edited in place (state JSON; written only by locked structural flows; page
versions = free audit history), a BATCH PAGE per batch (body = blueprint +
run table; footer comments = best-effort run-closed index), and one RUN PAGE
per planned run whose footer comments are that run's claim + append-only
checkpoints (= resume points) and whose body becomes the run report. The
batch summary is a child page. Slack (`config.slack.channelId`) gets ONE
best-effort notify line per run close. Nothing is written to the repo. The
blueprint itself is never persisted: it is deterministically rebuilt from
`pinnedCommit + rules + overrides` by `scripts/manifest.mjs` and validated by
hash. Works identically in local sessions and fresh cloud sandboxes.

## Invocation grammar

```
/1k-cycle-scan                       → status of all dimensions
/1k-cycle-scan perf                  → claim and scan one idle run of the perf dimension
/1k-cycle-scan perf 100k             → slice size (lines) — applies only when this
                                       invocation OPENS a batch (the run table is fixed
                                       then); mid-batch it is ignored with a hint
/1k-cycle-scan perf 重点看启动路径     → trailing free text = focus hint for the claimed run
/1k-cycle-scan security              → other dimensions, same lifecycle
/1k-cycle-scan <new-topic …>         → bootstrap a custom dimension (charter from the text)
/1k-cycle-scan perf report           → link the latest run report / batch summary
/1k-cycle-scan perf rebuild          → force-close the batch, re-pin and rebuild (confirm first)
```

Parallelism: just invoke the skill from several sessions (Slack threads,
scheduled cloud agents) — each claims its own run. 2–3 concurrent sessions is
the practical sweet spot; beyond that, org-level API rate limits flatten the
speedup while cost keeps scaling.

## Execution — read the playbook

All procedures live in [references/run-playbook.md](references/run-playbook.md).
Decision tree (routing uses the state JSON plus the batch page's run-closed
index — never percentages):

1. **Preflight always**: config + Confluence reachability + git. Confluence
   unreachable → STOP before any scanning (results would be unpersistable).
   Slack is notification-only; Slack unreachable NEVER stops a scan.
   State JSON `"v": 5` → run the migration retrofit (protocol) first.
2. `status` / `report` → Flow A (read-only).
3. `rebuild` → Flow F (destructive; user confirmation required).
4. No state page for the dimension → Flow B (bootstrap), then C.
5. `batch == 0`, or batch complete with `summaryPageId != null` → Flow C
   (batch start: fetch `origin/<mainBranch>`, pin HEAD, blueprint via script,
   model reviews only the suspects list, pre-slice the run table via
   `chunk.mjs --plan-runs`, pre-create all run pages), then D.
6. Batch complete (every table run closed with empty `missingIdx`) with
   `summaryPageId == null` → Flow E (batch summary).
7. Otherwise → Flow D (run): rebuild blueprint → verify hashes → pick a
   pickable run (scan → repair/voided → stale takeover, as judged by
   `coordinate.mjs --op run-status`) → claim it on its run page → `chunk.mjs`
   slice (assert table boundary) → scan groups via Workflow multi-agent
   orchestration (ultracode — see Hard rules) → checkpoint per group on the
   run page → reconcile (re-verify ownership) → report into the run page
   body → close comment → index comment. Nothing pickable but runs in
   flight → report status and stop (the per-run locks are working as
   intended).

Size overrides like `100k` must be converted to integer lines (`100000`)
before reaching `chunk.mjs` — the script rejects anything else.

Page tree, state schema, locking, checkpoint comments, crash recovery, Slack
notify: [references/persistence-protocol.md](references/persistence-protocol.md).

## Scripts (execute, don't read)

```bash
RUN_TMP="$(mktemp -d "${TMPDIR:-/tmp}/1k-cycle-scan-${DIM}.XXXXXX")"
node scripts/manifest.mjs --repo <wt> --out "$RUN_TMP/m.jsonl" [--stats] [--suspects] [--overrides "$RUN_TMP/ov.json"]
node scripts/chunk.mjs --manifest "$RUN_TMP/m.jsonl" --repo <wt> --cursor <run.start> --lines <table.runLines> \
  --group-lines <n> --group-files <n> [--done-indices "1,2" --preserve-group-ids] --out "$RUN_TMP/g.json"
node scripts/chunk.mjs --manifest "$RUN_TMP/m.jsonl" --cursor 0 --lines 50000 --plan-runs [--first-run 1] --out "$RUN_TMP/runs.json"
node scripts/coordinate.mjs --op run-status|pick-order|batch-status|plan-run|reconcile|make-comment|make-report|state|route …
```

All transient files for one invocation MUST stay under that invocation's
`$RUN_TMP`; fixed `/tmp/*.json` names are unsafe when multiple local sessions
run on the same machine. All print small JSON summaries; never read the
manifest/groups files fully
into context (5,400+ entries). v6 note: `--done-indices` is always paired
with `--preserve-group-ids` (fill-budget resume would cross the run table's
boundaries and fail the `proposedCursor == run.end` assert). Calibration
(2026-06, commit `6fa8720f5d`, apps/cli excluded by default): 5,435 files /
949,156 lines; manifest determinism is hash-verified on every run.

`coordinate.mjs` is the protocol engine: ownership fold, pickability,
staleness, circuit breakers, completeness, progress, hash/boundary asserts
(plan-run), coverage reconciliation, comment bodies, Slack lines, run report
bodies, state transitions, routing. The model never hand-evaluates or
hand-formats any of these — it dumps Confluence comments/pages to JSON, runs
the op, and executes the output (see the protocol's Engine rule).
`scripts/coordinate.test.mjs` replays the adversarial-review failure
timelines; run it after any engine change.

## Dimensions

- `perf` (built-in): rules in [references/perf-rules.md](references/perf-rules.md)
  — 23 categories + false-positive guards + P0/P1/P2 framework. Scan agents
  must read it fully.
- `security` (semi-built-in) and custom dimensions: rules are generated at
  bootstrap and persisted as a Confluence rules page (see playbook Flow B).
- Per-dimension scope overrides (e.g. include `presetNetworks.ts` for
  security) ride along in the state JSON (`overrides`) and feed
  `manifest.mjs --overrides`.

## Hard rules

- **ultracode** — scan fan-out, adversarial verification, and batch-summary
  review MUST be orchestrated with the Workflow tool (multi-agent subagent
  pipelines, see the playbook template). This skill instruction is the user's
  explicit opt-in to multi-agent orchestration. Fall back to direct Agent
  fan-out ONLY when the Workflow tool is genuinely absent from the harness —
  never scan sequentially in the main loop. In Codex, the direct Agent
  fallback is `multi_agent_v1.spawn_agent` plus `multi_agent_v1.wait_agent`,
  capped by `config.defaults.maxConcurrentAgents`; the main agent remains the
  orchestrator for checkpoint reconciliation, report creation, state updates,
  and Slack notification.
- NEVER modify repo code, commit, or push. Scanning is read-only; reports are
  the only artifact. Single exemption: writing the `confluence`/`slack`
  connection IDs into this skill's `config.json` during local bootstrap (the
  user commits it).
- Scan agents read files from the pinned temp worktree, never the dev checkout.
- Agent outputs are not trusted until they pass
  `scripts/validate-agent-output.mjs`. StructuredOutput/schema options are only
  first-pass steering; the orchestrator must validate scan/refute JSON, return
  validation errors to the agent for repair, and accept results only after the
  local validator succeeds.
- One runner per RUN at a time (run-page claim with stale-takeover, see
  protocol); structural flows (bootstrap/batch open/summary/rebuild) are
  single-runner via the batch-level state lock. Never scan without owning the
  claim; the state page is never written by a scanning runner.
- Protocol decisions are COMPUTED, never reasoned: ownership, pickability,
  staleness, breakers, completeness, comment bodies, state transitions, and
  routing all come from `scripts/coordinate.mjs`. If your conclusion differs
  from the engine's output, the engine wins.
- A run counts as covered only when its close comment shows empty
  `missingIdx`; partial progress lives in the run page's checkpoints.
- Respect the rules file's false-positive guards; when verification refutes a
  finding, it stays out of reports.
- Reports, summaries, progress lines, and Slack notifications are written in
  Chinese; markers, JSON payloads, paths, and category keys stay English.
- Costs are real (~12–16 scan agents + verifiers per default run). Don't
  silently exceed the requested slice size.
