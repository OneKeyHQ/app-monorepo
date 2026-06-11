# Run Playbook

Detailed flows. `SKILL.md` decides which flow applies; this file is the
authoritative procedure for each. Page tree, state schema, locking,
staleness, checkpoint comments, Slack notify:
see [persistence-protocol.md](persistence-protocol.md). "Update the state
page" below always means: `updateConfluencePage` with the full new body
(progress table + state JSON) and a meaningful `versionMessage`.

## Contents
- Preflight (every invocation)
- Shared: materialize the pinned tree / script provenance
- Flow A: status & report
- Flow B: dimension bootstrap
- Flow C: batch start
- Flow D: run (the main flow)
- Flow E: batch summary
- Flow F: rebuild
- Scan agent prompt + finding schema
- Workflow template
- Report templates

## Preflight (every invocation)

1. Read `config.json` (skill dir). All tunables come from `defaults` —
   `runLines`, `groupLines`, `groupFiles` (passed to chunk.mjs as CLI args),
   `verifySeverities`, `staleRunMinutes`, `maxConcurrentAgents` — and
   `mainBranch` for every fetch. Values hardcoded in scripts/templates are
   fallbacks only; config wins.
2. `confluence.cloudId/spaceId/parentPageId` null →
   - local session: ask the user for the parent page URL once, resolve the
     IDs, write them into `config.json` (the ONE repo file this skill may
     write — bootstrap exemption), remind them to commit;
   - cloud sandbox: STOP and tell the user to bootstrap locally and commit.
3. Confluence probe per protocol (`getConfluencePage` on the parent page).
   Failure → STOP.
4. `git -C <repo> rev-parse --git-dir` works; `node --version` works.

Repo root = the current project root (the checkout the session runs in, or any
worktree of it).

## Shared: materialize the pinned tree

Idempotent; used by Flows C, D, E. Abort (and release the lock) on ANY
assertion failure — never swallow errors here.

```bash
PIN=<pinned commit>; DIM=<dimension>
git worktree prune
if ! git cat-file -e "${PIN}^{commit}" 2>/dev/null; then
  if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
    git fetch --depth 1 origin "$PIN"   # fresh cloud sandbox: stays shallow
  else
    git fetch origin "$PIN"             # full clone: NEVER depth-fetch (it would
  fi                                    # turn the user's repo shallow)
fi
WT="/tmp/1k-cycle-scan-wt-${DIM}"
[ -d "$WT" ] || git worktree add --detach "$WT" "$PIN"
[ "$(git -C "$WT" rev-parse HEAD)" = "$PIN" ] || git -C "$WT" checkout --detach "$PIN"
[ "$(git -C "$WT" rev-parse HEAD)" = "$PIN" ]  # hard assert
```

**Script provenance**: a batch's blueprint algorithm must be frozen with the
pin, or any merged change to `manifest.mjs` would hash-strand every in-flight
batch. Always prefer the pinned tree's copy:

```bash
SCRIPTS="$WT/.skillshare/skills/1k-cycle-scan/scripts"
[ -f "$SCRIPTS/manifest.mjs" ] || SCRIPTS="<session skill dir>/scripts"  # pre-merge pins only
```

Scan agents read files from `$WT`, never from the dev checkout.

## Flow A: status & report

**status**: discover each dimension's state page (protocol) → one line per
dimension from its state JSON:
`perf · batch 2 · run 7 · 10.3% (581/5623 files) · idle · updated 2h ago`.
No state page → explain nothing exists yet and show the invocation grammar.

**report**: from the state JSON, list the batch page's children
(`getConfluencePageDescendants` on `batchPageId`) → link the newest run
report page and, if `summaryPageId`, the summary page. Read-only — no lock.

## Flow B: dimension bootstrap (no state page for the requested dimension)

1. Resolve the rules source:
   - `perf` (built-in): `config.builtinDimensions.perf.rules`
     (= `references/perf-rules.md`).
   - `security` (semi-built-in): generate `security-rules.md` content by
     distilling `.claude/skills/1k-code-review-pr` (security sections) and
     `.claude/skills/1k-auditing-pre-release-security`; same category format
     as perf-rules.md. Persist as a rules page
     (`CycleScan · security · Rules v1`, child of the state page once it
     exists — create state page first, then rules page);
     `rulesSource: "page:<pageId>"`.
   - Anything else: treat the free text as the dimension charter. Propose a
     short kebab-case slug and a 10–25 category checklist (grounded in repo
     skills where relevant), confirm with the user, persist like security.
2. Decide manifest overrides (e.g. security probably wants
   `disableRules: ["preset-networks-data"]` — config data IS security-
   relevant). Default: none.
3. Create the STATE PAGE (`CycleScan · <dim>`, child of the parent page):
   v5 state JSON with `status=idle`, `batch=0`, `cursor=0`, `rulesSource`,
   `overrides`, page IDs null.
4. Continue to Flow C.

## Flow C: batch start

Route in: `batch == 0`, or `cursor >= totalFiles && summaryPageId != null`,
or Flow F. (`cursor >= totalFiles && summaryPageId == null` → Flow E first.)

1. Acquire the lock on the state page (protocol; `status=running`).
2. `git fetch origin <config.mainBranch>` → `PIN=$(git rev-parse FETCH_HEAD)`.
3. Materialize the pinned tree; resolve `SCRIPTS`.
4. Blueprint + suspects:
   ```bash
   node "$SCRIPTS/manifest.mjs" --repo "$WT" --stats --suspects \
     --out "/tmp/1k-cycle-scan-manifest-${DIM}.jsonl" [--overrides /tmp/ov.json]
   ```
   Assert the JSON's `commit` equals `$PIN`.
5. Review ONLY the `suspects` list (≤60 entries): genuinely generated files or
   data-as-code → add to `overrides.addExclude`; big real-code files are fine
   (they are exactly what we scan). Rerun with updated overrides. Do NOT read
   the manifest itself into context.
6. Create the BATCH PAGE (`… · batch-<NNN>`, child of the state page): pin
   commit, hashes, totals, suspects-review decisions, `forcedRebuild` note
   when arriving via Flow F.
7. Release-update the state page: `batch+1`, `batchPageId=<new page>`,
   `run=0`, `runIncomplete=false`, `cursor=0`, `scannedLines=0`, new
   `pinnedCommit`/`manifestHash`/`rulesHash`/`overrides`/`totalFiles`/
   `totalLines`, `prevBatchPageId=<old batchPageId>`,
   `prevSummaryPageId=<old summaryPageId>`, `summaryPageId=null`,
   `status=idle`. versionMessage: `batch <B> open`.
8. Tell the user the new batch is open, then continue into Flow D in the same
   invocation.

## Flow D: run

1. Read the state page; determine the mode:
   - `status != idle` and not stale (protocol: state heartbeat AND newest
     current-run checkpoint comment both old) → abort: a runner is live.
   - `status != idle` and stale → **recovery mode**.
   - `status = idle` and `runIncomplete` → **continuation mode**.
   - else → **normal mode**.
   In recovery/continuation: keep the run number and collect DONE_INDICES
   from the batch page's checkpoint comments for that run.
2. Acquire the lock (state page update). Normal mode also sets `run+=1` in
   the same update.
3. Materialize the pinned tree; resolve `SCRIPTS`.
4. Rebuild blueprint:
   ```bash
   node "$SCRIPTS/manifest.mjs" --repo "$WT" --out /tmp/...jsonl [--overrides ...]
   ```
   Assert `commit == state.pinnedCommit` and
   `manifestHash == state.manifestHash`. Mismatch → release the lock (update:
   `status=idle`, `run` rolled back) and STOP with a diagnostic (script drift
   vs pin — see provenance note — or wrong commit).
5. Plan the slice:
   ```bash
   node "$SCRIPTS/chunk.mjs" --manifest /tmp/...jsonl --cursor <state.cursor> \
     --lines <N> --group-lines <config> --group-files <config> \
     [--done-indices <DONE_INDICES>] --out /tmp/1k-cycle-scan-groups.json
   ```
   `--lines`: the user's override converted to an integer (`100k` → `100000`),
   else `config.defaults.runLines`. The script rejects non-integers. Surface
   `strandedDoneIndices` to the user if non-empty (those files will be
   replanned later — known double-scan).
6. Scan groups — **ultracode**: orchestrate with the Workflow tool (template
   below); the skill mandates multi-agent orchestration and counts as the
   user's explicit opt-in. Only if the Workflow tool is genuinely absent,
   fall back to direct Agent fan-out capped at
   `config.defaults.maxConcurrentAgents`. Per group: scan agent → refute
   findings whose severity ∈ `config.defaults.verifySeverities` → post the
   checkpoint COMMENT on the batch page (marker carries the run number;
   human line carries live progress). Checkpoint comment timestamps double
   as the lock heartbeat.
7. Reconcile — compare checkpoint comments against the plan. Two DIFFERENT
   gaps:
   a. Group has scan results but no checkpoint (posting failed) → post it now
      from the orchestrator's data.
   b. Group has NO scan result (agent died/timeout) → re-run that group once
      (scan + verify + checkpoint). Still failing → do NOT advance anything
      for it; never fabricate its checkpoint.
8. Close the run:
   - All groups checkpointed → create the run report page (child of the
     batch page, template below), then release-update the state page:
     `status=idle`, `runIncomplete=false`, `cursor=<plan.proposedCursor>`,
     `scannedLines=<plan.linesThroughProposedCursor>`, `updatedAt`, progress
     table refreshed. versionMessage: `run <R> closed · <Y>%`.
   - Some groups failed (7b) → same, except: cursor and scannedLines stay
     UNCHANGED, `runIncomplete=true`, and the report page + your reply say
     exactly which groups are missing. The next invocation continues this run.
9. Slack notify (best-effort, one line, Chinese):
   `perf · R<NNN> 完成 · <X>%→<Y>% · P0×a P1×b P2×c · 报告: <report page URL>`.
10. Reply to the user: coverage X%→Y%, P0/P1 counts with one-line examples,
    report page link, next-step hint.
11. `plan.exhausted && !runIncomplete` → coverage is 100%: announce and run
    Flow E NOW (the worktree is still needed). Otherwise optionally
    `git worktree remove --force "$WT"` (skip in cloud sandboxes — ephemeral
    anyway).

## Flow E: batch summary

Route in: `cursor >= totalFiles && summaryPageId == null` (fresh invocation),
or directly from Flow D step 11.

1. Acquire the lock (`status=summarizing`) unless arriving from Flow D with
   the lock already held (then update status to `summarizing`).
2. Materialize the pinned tree (a fresh sandbox arriving here has nothing).
   Also `git fetch origin <config.mainBranch>` and keep
   `LATEST=$(git rev-parse FETCH_HEAD)`; read current-x file content via
   `git show ${LATEST}:<path>` (no second worktree needed).
3. Collect ALL checkpoint comments from the batch page (every run of this
   batch). Unescape, parse, flatten.
4. Dedup key: `path + category + floor(line/30)`. Merge duplicates (keep
   highest severity/confidence).
5. Cluster by module (top 2–3 path segments). Per cluster, spawn a reviewer
   agent (**ultracode**: fan these out with the Workflow tool too): confirm
   each finding in `$WT` (refresh line refs), then check
   `git show ${LATEST}:<path>` — gone on latest x → `fixedOnMain: true`.
6. Previous batch comparison: read `prevSummaryPageId` (its trailing compact
   JSON block) → label findings new / recurring / fixed.
7. Create the summary page (child of the batch page, template below; body
   ends with the compact open-findings JSON block). Slack notify one line.
8. Release-update the state page: `summaryPageId=<new page>`, `status=idle`.
   versionMessage: `batch <B> complete · summary ready`. Remove the temp
   worktree. The next invocation routes to Flow C.

## Flow F: rebuild (`/1k-cycle-scan <dim> rebuild`)

Destructive: abandons the current batch's remaining coverage. Requires
explicit user confirmation in-conversation (state the current batch, coverage,
and that unscanned files will only be covered by the NEXT batch's blueprint).
Then execute Flow C; note `forcedRebuild · abandoned at <X>%` on both the old
batch page (append a panel) and the new batch page. Do NOT create a summary
for the abandoned batch.

## Scan agent prompt (per group)

```
You are scanning OneKey monorepo source files for <dimension> issues.
Repo checkout (read-only): <WT> at commit <PIN>.

1. Read the rules checklist FULLY first: <rules location — file path, or
   inline content for page-sourced rules>. Respect its false-positive guards
   and severity framework.
2. Read each assigned file COMPLETELY (paths relative to <WT>):
   <path (lines)> ...
   The ENTIRE worktree is readable. When a verdict depends on cross-file
   context — callers, imported helpers, list sizes, whether code sits on a
   startup/hot path — follow the references and read those related files too.
   Anchor each finding at the location that best identifies the ROOT CAUSE:
   usually inside your assigned files, but if the real problem lives in a
   related file (e.g. a shared helper with the hot loop), anchor it THERE —
   that is what makes the report actionable. Possible duplicates with that
   file's own future scan are fine; the batch summary dedups by
   path+category+line.
3. Report only issues tied to specific code, with category keys from the
   checklist. No style nits, no refactor opinions, no fixes — findings only.
   An empty findings list is a perfectly good answer.
   Write title/evidence-notes/suggestion in CHINESE (keep code identifiers,
   paths, and category keys in English). In titles, avoid angle brackets and
   bare URLs.
<focus hint from the user's trailing free text, if any>
```

Finding schema (Workflow `schema` option / StructuredOutput):

```json
{ "type": "object", "required": ["findings"], "properties": { "findings": {
  "type": "array", "items": { "type": "object",
    "required": ["path", "line", "category", "severity", "title", "confidence"],
    "properties": {
      "path": { "type": "string" }, "line": { "type": "number" },
      "category": { "type": "string" },
      "severity": { "enum": ["P0", "P1", "P2"] },
      "title": { "type": "string", "description": "one line, ≤120 chars, no angle brackets/URLs" },
      "evidence": { "type": "string", "description": "≤3 code lines" },
      "suggestion": { "type": "string", "description": "one line" },
      "confidence": { "type": "number" } } } } } }
```

Refuter prompt (each finding with severity ∈ `config.defaults.verifySeverities`):
*"Adversarially verify this finding — read <path> around line <line> in <WT>
plus enough context to judge. Finding: <title / evidence>. Rules context:
<category excerpt>. Default to refuted when uncertain."* Schema:
`{refuted: boolean, reason: string}`. Refuted → drop from checkpoint, count in
the report.

## Workflow template (adapt, don't copy blindly)

```js
export const meta = { name: 'cycle-scan-run', description: 'Scan one slice',
  phases: [{ title: 'Scan' }, { title: 'Verify' }] }
// args: { groups, wt, pin, dimension, rulesLocation, focus,
//         cloudId, batchPageId, runNumber, verifySeverities }
// Defensive: depending on the harness, `args` may arrive JSON-stringified.
const ARGS = typeof args === 'string' ? JSON.parse(args) : args
// Template-literal gotcha: to emit ```json fences inside prompts, use a
// FENCE const ('``' + '`') — raw backticks terminate the template literal.
const results = await pipeline(
  ARGS.groups,
  (g) => agent(scanPrompt(g), { label: `scan:g${g.id}`, phase: 'Scan', schema: FINDINGS }),
  async (res, g) => {
    const verdicts = await parallel(
      res.findings.filter((f) => ARGS.verifySeverities.includes(f.severity)).map((f) => () =>
        agent(refutePrompt(f), { label: `refute:g${g.id}`, phase: 'Verify', schema: VERDICT })
          .then((v) => ({ f, refuted: v?.refuted ?? false }))));
    const refutedSet = new Set(verdicts.filter(Boolean).filter((v) => v.refuted).map((v) => v.f))
    const kept = res.findings.filter((f) => !refutedSet.has(f))
    // best-effort in-flight checkpoint; orchestrator reconciles afterwards
    // (playbook Flow D step 7)
    await agent(checkpointPrompt(g, kept, ARGS), { label: `ckpt:g${g.id}`, phase: 'Verify' })
    return { group: g.id, idx: g.files.map((x) => x.i), kept,
      refuted: res.findings.length - kept.length }
  })
return { results }  // keep nulls: a null slot = group with NO result (step 7b)
```

`checkpointPrompt` instructs a minimal agent to load
`mcp__claude_ai_Atlassian__createConfluenceFooterComment` via ToolSearch and
post the checkpoint comment (marker + compact JSON + human progress line,
markdown contentFormat) on `ARGS.batchPageId` with `ARGS.cloudId`. If unsure
it succeeded, say so — the orchestrator's reconciliation re-posts.

## Report templates

Reports are written in CHINESE (the user-facing deliverable); keep code
identifiers, paths, category keys, markers, and JSON in English.

Run report page (`CycleScan · <dim> · B<NNN> · R<NNN>`, child of the batch
page, markdown; numbers zero-padded to 3 digits):

```markdown
| | |
|---|---|
| 日期 / commit | <date> / `<pin sha12>` |
| 本轮范围 | manifest [<from>, <to>) — <files> 个文件,<lines> 行 |
| 覆盖率 | <X>% → <Y>%(<cursor>/<totalFiles> 文件) |
| 发现 | P0 <n> · P1 <n> · P2 <n>(对抗校验驳回 <n> 个) |
| 本轮关注点 | <用户附加提示词,或 —> |
| 未完成分组 | <无,或待续扫的 group id> |

## P0
- `path:line` **[category]** 中文问题描述(置信度 0.9)
  - 证据:`...`
  - 建议:...
## P1 / ## P2(同上结构)
## 按类别统计
| 类别 | P0 | P1 | P2 |
## 扫描范围
<本轮各顶层目录的文件数>
```

Batch summary page (`CycleScan · <dim> · B<NNN> · Summary`):

```markdown
Pinned `<sha12>` · <runs> 轮 · <files>/<lines> 全覆盖(100%)· <起止日期>

## TOP 问题(已结合代码评审)
排序清单:严重级别、path:line、中文描述、所属模块、是否已在最新 x 修复
## 按模块统计
| 模块 | P0 | P1 | P2 | 密度(/kloc) |
## 与上一批次对比
新增 <n> · 遗留 <n> · 已修复 <n>(列出已修复项——它们是成果)
## 本批次口径变更
suspects 复核决定、overrides 变更

## Open findings (machine-readable — do not edit)
```json
[ { "p": "...", "l": 120, "cat": "...", "sev": "P1", "t": "...", "conf": 0.85, "st": "new" } ]
```
```
