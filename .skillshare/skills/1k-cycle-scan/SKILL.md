---
name: 1k-cycle-scan
description: Recurring, resumable whole-repo scan harness. Sweeps the OneKey monorepo in batches across configurable dimensions (performance, security, custom), slicing each batch into runs with exact per-file coverage tracking, Confluence-persisted state/checkpoints/reports, a code-reviewed batch summary, and one-line Slack notifications. Manual-only — never auto-invoked; trigger explicitly via /1k-cycle-scan <dimension>.
disable-model-invocation: true
---

# 1k-cycle-scan — recurring whole-repo scan

Finds issues; never fixes or cleans anything. Output is reports only.

**Core model**: a *dimension* (perf / security / custom checklist) is scanned in
*batches*. A batch pins one commit of `origin/x`, builds a deterministic
file blueprint from it, and reaches 100% file coverage across multiple *runs*
(one run = one invocation = one slice, default 50k lines). Each run fans out
scan agents over ~4k-line *groups*, checkpoints after every group, and produces
a Markdown report. At 100%, a code-reviewed batch summary closes the batch; the
next invocation re-pins latest `origin/x` and opens the next batch.

**Persistence**: everything lives in a Confluence page tree under a fixed
parent page (claude.ai Atlassian connector). Per dimension: a STATE PAGE
edited in place (current progress + state JSON; page versions = free audit
history), a BATCH PAGE per batch whose footer comments are the append-only
checkpoints (= resume points), and real child pages for run reports and the
batch summary. Slack (`config.slack.channelId`) gets ONE best-effort notify
line per run close. Nothing is written to the repo. The blueprint itself is
never persisted: it is deterministically rebuilt from
`pinnedCommit + rules + overrides` by `scripts/manifest.mjs` and validated by
hash. Works identically in local sessions and fresh cloud sandboxes.

## Invocation grammar

```
/1k-cycle-scan                       → status of all dimensions
/1k-cycle-scan status                → same
/1k-cycle-scan perf                  → scan the next slice of the perf dimension
/1k-cycle-scan perf 100k             → override slice size (lines) for this run
/1k-cycle-scan perf 重点看启动路径     → trailing free text = focus hint for this run
/1k-cycle-scan security              → other dimensions, same lifecycle
/1k-cycle-scan <new-topic …>         → bootstrap a custom dimension (charter from the text)
/1k-cycle-scan perf report           → link the latest run report / batch summary
/1k-cycle-scan perf rebuild          → force-close the batch, re-pin and rebuild (confirm first)
```

## Execution — read the playbook

All procedures live in [references/run-playbook.md](references/run-playbook.md).
Decision tree (routing uses integers from the state message — never
percentages):

1. **Preflight always**: config + Confluence reachability + git. Confluence
   unreachable → STOP before any scanning (results would be unpersistable).
   Slack is notification-only; Slack unreachable NEVER stops a scan.
2. `status` / `report` → Flow A (read-only).
3. `rebuild` → Flow F (destructive; user confirmation required).
4. No pinned state for the dimension → Flow B (bootstrap), then C.
5. `batch == 0`, or `cursor >= totalFiles && summaryPageId != null` → Flow C
   (batch start: fetch `origin/<mainBranch>`, pin HEAD, blueprint via script,
   model reviews only the suspects list), then D.
6. `cursor >= totalFiles && summaryPageId == null` → Flow E (batch summary).
7. Otherwise → Flow D (run): lock state (nonce protocol) → rebuild blueprint
   → verify `manifestHash` → `chunk.mjs` slice → scan groups via Workflow
   multi-agent orchestration (ultracode — see Hard rules) → checkpoint per
   group → reconcile → report → advance cursor → unlock.

Size overrides like `100k` must be converted to integer lines (`100000`)
before reaching `chunk.mjs` — the script rejects anything else.

Page tree, state schema, locking, checkpoint comments, crash recovery, Slack
notify: [references/persistence-protocol.md](references/persistence-protocol.md).

## Scripts (execute, don't read)

```bash
node scripts/manifest.mjs --repo <wt> --out /tmp/m.jsonl [--stats] [--suspects] [--overrides ov.json]
node scripts/chunk.mjs --manifest /tmp/m.jsonl --cursor <n> [--lines 50000] [--done-indices "1,2"] --out /tmp/g.json
```

Both print small JSON summaries; never read the manifest/groups files fully
into context (5,400+ entries). Calibration (2026-06, commit `6fa8720f5d`,
apps/cli excluded by default): 5,435 files / 949,156 lines; manifest
determinism is hash-verified on every run.

## Dimensions

- `perf` (built-in): rules in [references/perf-rules.md](references/perf-rules.md)
  — 23 categories + false-positive guards + P0/P1/P2 framework. Scan agents
  must read it fully.
- `security` (semi-built-in) and custom dimensions: rules are generated at
  bootstrap and persisted in the channel (see playbook Flow B).
- Per-dimension scope overrides (e.g. include `presetNetworks.ts` for
  security) ride along in the state message and feed `manifest.mjs --overrides`.

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
- One runner per dimension at a time (state lock with stale-takeover, see
  protocol).
- Cursor advances only after a fully completed slice; partial progress lives
  in checkpoints.
- Respect the rules file's false-positive guards; when verification refutes a
  finding, it stays out of reports.
- Reports, summaries, progress lines, and Slack notifications are written in
  Chinese; markers, JSON payloads, paths, and category keys stay English.
- Costs are real (~12–16 scan agents + verifiers per default run). Don't
  silently exceed the requested slice size.
