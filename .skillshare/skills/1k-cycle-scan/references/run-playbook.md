# Run Playbook

Detailed flows. `SKILL.md` decides which flow applies; this file is the
authoritative procedure for each. Page tree, state schema, locks/claims,
staleness, checkpoint comments, Slack notify:
see [persistence-protocol.md](persistence-protocol.md). "Update the state
page" below always means: `updateConfluencePage` with the full new body
(progress snapshot + state JSON) and a meaningful `versionMessage` — and is
only ever done by a flow holding the batch-level state lock.

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
2. `confluence.cloudId/spaceId/spaceKey/parentPageId` null →
   - local session: ask the user for the parent page URL once, resolve the
     IDs, write them into `config.json` (the ONE repo file this skill may
     write — bootstrap exemption), remind them to commit;
   - cloud sandbox: STOP and tell the user to bootstrap locally and commit.
   (`spaceKey` is required by the CQL discovery fallback — its absence must
   fail here, not get misdiagnosed as "Confluence unreachable" later.)
3. Confluence probe per protocol. Try `getConfluencePage` on
   `config.confluence.parentPageId`; if it returns 404, treat the parent as a
   possible Confluence folder and continue with CQL discovery:
   `space = "<spaceKey>" AND type = page AND title ~ "CycleScan"`, then exact
   match `CycleScan · <dim>` and read that page by ID. A parent-page 404 alone
   is NOT proof that Confluence is unreachable. STOP only when both targeted
   page reads and CQL fail, or when the requested bootstrap has no readable
   parent/state target to persist into.
4. Slack is not a preflight dependency. If Slack send later fails, keep the
   persisted Confluence state/report and mention the Slack failure to the user.
5. `git -C <repo> rev-parse --git-dir` works; `node --version` works.
6. State JSON `"v": 5` → run the migration retrofit
   (protocol → Migration v5 → v6) before anything else that scans.
7. After `DIM` is known, create one private temp directory for this invocation:
   ```bash
   RUN_TMP="$(mktemp -d "${TMPDIR:-/tmp}/1k-cycle-scan-${DIM}.XXXXXX")"
   ```
   Use `$RUN_TMP` for EVERY transient JSON/raw-output file. Never write
   manifest, run table, comment dumps, group plans, scan outputs, or refute
   outputs to fixed `/tmp/*.json` paths: multiple local sessions on the same
   machine can run at once. The pinned worktree `$WT` below is the only
   intentional shared `/tmp` path.
8. Routing is computed, not reasoned:
   `node "$SCRIPTS/coordinate.mjs" --op route --state "$RUN_TMP/state.json"
   [--index "$RUN_TMP/batch-comments.json" --table "$RUN_TMP/runs.json"]
   [--subcommand status|report|rebuild|scan]` → the flow to execute.

Repo root = the current project root (the checkout the session runs in, or any
worktree of it).

**Engine discipline (applies to every flow below)**: protocol decisions —
ownership, pickability, staleness, breakers, completeness, progress, comment
bodies, state transitions, routing — are computed by
`scripts/coordinate.mjs`; the model only dumps Confluence data to JSON files
(ALWAYS paginate comment reads to exhaustion) and executes the engine's
output. Comment dumps are arrays of `{ "body", "createdAt" }`. Prefer the
PINNED tree's coordinate.mjs (same provenance rule as the other scripts).

## Shared: materialize the pinned tree

Idempotent; used by Flows C, D, E. Abort (and void any claim / release any
lock you hold) on ANY assertion failure — never swallow errors here.

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

Parallel-session note: each session materializes its own `$WT` path — they
are different sandboxes/machines in the normal case. Two sessions on the SAME
machine share `$WT` safely because both pin the same commit (the hash asserts
catch any divergence).

**Script provenance**: a batch's blueprint algorithm must be frozen with the
pin, or any merged change to `manifest.mjs` would hash-strand every in-flight
batch. Always prefer the pinned tree's copy:

```bash
SCRIPTS="$WT/.skillshare/skills/1k-cycle-scan/scripts"
[ -f "$SCRIPTS/manifest.mjs" ] || SCRIPTS="<session skill dir>/scripts"  # pre-merge pins only
```

Scan agents read files from `$WT`, never from the dev checkout.

## Flow A: status & report

**status**: discover each dimension's state page (protocol) → for an open v6
batch, dump the batch page comments and run
`coordinate.mjs --op pick-order --table … --index … --nonce <any>` — its
`progress` is the display source. Print one line per dimension:
`perf · B002 · 已关 8/19 run · 已覆盖 41.2% 行 · 进行中/待认领其余 · summary 未生成 · state 更新于 2h 前`.
The state page's own progress snapshot may lag (it only refreshes under the
batch lock) — the index is the live source. `"v": 5` state → show its v5
fields and note the dimension migrates on the next scan invocation (with
user confirmation, see protocol Migration). No state page → explain nothing
exists yet and show the invocation grammar.

**report**: from the run table, link the newest closed run page (pick via the
run-closed index) and, if `summaryPageId`, the summary page. Read-only — no
lock, no claim.

## Flow B: dimension bootstrap (no state page for the requested dimension)

1. Resolve the rules source:
   - `perf` (built-in): `config.builtinDimensions.perf.rules`
     (= `references/perf-rules.md`).
   - `security` (semi-built-in): generate `security-rules.md` content by
     distilling `.claude/skills/1k-code-review-pr` (security sections) and
     `.claude/skills/1k-auditing-pre-release-security`; same category format
     as perf-rules.md. Persisted as a rules page in step 3;
     `rulesSource: "page:<pageId>"`.
   - Anything else: treat the free text as the dimension charter. Propose a
     short kebab-case slug and a 10–25 category checklist (grounded in repo
     skills where relevant), confirm with the user, persist like security.
2. Decide manifest overrides (e.g. security probably wants
   `disableRules: ["preset-networks-data"]` — config data IS security-
   relevant). Default: none.
3. Create the pages, in this order (idempotency rule on every create —
   a title conflict means a concurrent/earlier bootstrap: adopt and continue):
   a. STATE PAGE (`CycleScan · <dim>`, child of the parent page), body from
      `coordinate.mjs --op state --transition init --dimension <dim>
      [--rules-source <path-or-placeholder>] [--overrides <json>]`.
   b. Rules page (`CycleScan · <dim> · Rules v1`, child of the state page) —
      runtime dimensions only.
   c. Runtime dimensions: update the state page, backfilling
      `rulesSource: "page:<pageId>"`.
4. Continue to Flow C.

## Flow C: batch start

Route in: `batch == 0`, or batch complete with `summaryPageId != null`, or
Flow F. (Batch complete with `summaryPageId == null` → Flow E first.)

1. Acquire the batch-level state lock: new state body from
   `coordinate.mjs --op state --transition lock --state "$RUN_TMP/state.json"
   --flow opening --nonce $(openssl rand -hex 4)` (the op refuses a held,
   non-stale lock and enforces the v6 version guard); write it, wait ~5s,
   re-read, verify `runnerNonce` is yours (protocol).
2. `git fetch origin <config.mainBranch>` → `PIN=$(git rev-parse FETCH_HEAD)`.
3. Materialize the pinned tree; resolve `SCRIPTS`.
4. Blueprint + suspects:
   ```bash
   node "$SCRIPTS/manifest.mjs" --repo "$WT" --stats --suspects \
     --out "$RUN_TMP/manifest.jsonl" [--overrides "$RUN_TMP/overrides.json"]
   ```
   Assert the JSON's `commit` equals `$PIN`.
5. Review ONLY the `suspects` list (≤60 entries): genuinely generated files or
   data-as-code → add to `overrides.addExclude`; big real-code files are fine
   (they are exactly what we scan). Rerun with updated overrides. Do NOT read
   the manifest itself into context.
6. Plan the run table:
   ```bash
   node "$SCRIPTS/chunk.mjs" --manifest "$RUN_TMP/manifest.jsonl" --cursor 0 \
     --lines <RUN_LINES> --plan-runs --out "$RUN_TMP/runs.json"
   ```
   `RUN_LINES` = the user's size override converted to an integer (`100k` →
   `100000`) if this invocation opens the batch, else
   `config.defaults.runLines`. This fixes the slice size for the WHOLE batch
   — per-run overrides no longer exist (parallel claims replace them as the
   speed lever). Sanity: `runCount > 40` → confirm with the user before
   creating that many run pages (suggest a larger `RUN_LINES`).
7. Create the BATCH PAGE (`… · B<NNN>`, child of the state page; idempotency
   rule — a title conflict means a crashed earlier Flow C: adopt the page and
   resume): pin commit, hashes (`manifestHash`/`rulesHash` come from the
   manifest.mjs output JSON — never hash files yourself), totals,
   suspects-review decisions, `forcedRebuild` note when arriving via Flow F,
   plus the run-table JSON block (protocol) with `pageId: null` placeholders.
8. Pre-create one RUN PAGE per table entry (child of the batch page, title
   `CycleScan · <dim> · B<NNN> · R<NNN>`, placeholder body template below;
   idempotency rule per page). Collect the page IDs.
9. Update the batch page body: fill every table entry's `pageId`. (Steps 7–9
   all happen under the state lock; nobody else writes these pages yet.)
10. Release-update the state page with
    `coordinate.mjs --op state --transition open-batch --state "$RUN_TMP/state.json"
    --batch-page-id <id> --pin $PIN --manifest-hash <h> --rules-hash <h>
    --total-files <n> --total-lines <n> --run-count <n> --run-lines <n>
    [--overrides <json>]` (the op rolls `prev*`, resets `summaryPageId`,
    bumps `batch`, unlocks).
11. Tell the user the new batch is open (mention runCount and that parallel
    sessions can each claim a run), then continue into Flow D in the same
    invocation.

## Flow D: run (pick → claim → scan → close)

1. Read the state page. `v==5` → migration retrofit first (protocol). If
   `status` is `opening|summarizing|rebuilding` and not stale → abort: a
   structural flow is live; scanning would race it. (Never "clean up" a
   stale structural lock from Flow D — the next structural flow self-verifies
   its own lock.)
2. Materialize the pinned tree; resolve `SCRIPTS`. Rebuild the blueprint and
   SAVE the summary:
   ```bash
   node "$SCRIPTS/manifest.mjs" --repo "$WT" \
     --out "$RUN_TMP/manifest.jsonl" [--overrides ...] \
     > "$RUN_TMP/manifest-summary.json"
   ```
   No hand asserts here — `plan-run` (step 5) verifies
   commit/manifestHash/rulesHash against the state JSON and refuses to plan
   on drift, before any claim exists.
3. Read the batch page body (run table → `$RUN_TMP/runs.json`) and dump ALL batch
   page footer comments → `$RUN_TMP/batch-comments.json` (paginate to
   exhaustion). Then:
   ```bash
   node "$SCRIPTS/coordinate.mjs" --op pick-order --table "$RUN_TMP/runs.json" \
     --index "$RUN_TMP/batch-comments.json" --nonce <fresh nonce> \
     [--legacy-run <v5.run> --legacy-cursor <state.legacyCursor>] \
     --total-lines <state.totalLines>
   ```
   `fence` non-null → STOP (stale local state; re-read the state page).
   `allClosedPerIndex` → verify with Flow E's authoritative gate instead.
   RIGHT BEFORE probing, re-read the state page and assert `batchPageId`
   unchanged (protocol Batch fence; step 2 may have taken minutes).
4. Probe `candidates` in the engine's order (it shuffles per-session so
   parallel arrivals do not pile onto the same run): dump that run page's
   comments → `coordinate.mjs --op run-status --comments <dump> --my-nonce
   <nonce>`:
   - `pickable: scan|repair|voided|takeover` → claim it (step 5).
     `repair`/`voided`/`takeover` need no extra waiting — only live owners
     are protected by the staleness window.
   - `pickable: none` + `closed.complete` and the run had no index entry →
     post the missing `run-closed` index comment (make-comment, best-effort),
     next candidate.
   - `pickable: none` + `repairBreaker`/`voidBreaker` → STOP and surface the
     engine's `pickableReason` verbatim — it lists the user's options
     (orchestrator scans the group itself / user-confirmed waiver close /
     next-batch overrides exclude / Flow F rebuild as last resort).
   - `pickable: none` otherwise → busy; next candidate.
   - No candidate left → report `N run 进行中,无可认领 run;最早解锁时间
     <min(staleAt)>` and stop. This is the lock working as intended — its
     scope is the run, not the batch.
5. Plan the slice — BEFORE claiming, so every assert fires while walking away
   is still free:
   ```bash
   node "$SCRIPTS/coordinate.mjs" --op plan-run \
     --manifest "$RUN_TMP/manifest.jsonl" \
     --manifest-summary "$RUN_TMP/manifest-summary.json" \
     --state "$RUN_TMP/state.json" --table "$RUN_TMP/runs.json" --run <r> \
     --group-lines <g> --group-files <g> --repo "$WT" \
     [--done-indices <run-status doneIndices>] \
     --out "$RUN_TMP/groups.json"
   ```
   The engine asserts commit/manifestHash/rulesHash against the state, runs
   chunk.mjs (adding `--preserve-group-ids` whenever `--done-indices` is
   given), and asserts `proposedCursor == run.end` (table-drift guard). Any
   failure → STOP with its diagnostic; no claim was posted, nothing to void.
   `scan` mode: group params from config. `repair`/`takeover`/`voided`-with-
   checkpoints: copy `originalClaim`'s params and `doneIndices` from
   run-status — missing groups keep their original marker numbers. Surface
   `strandedDoneIndices` to the user if non-empty.
   `--repo` enables READ PROBES: files >1800 lines get a `probeLine` whose
   exact content the scan agent must echo back (proof it read past the Read
   tool's ~2000-line-per-call window). Keep probe line numbers in the group
   prompts but NEVER put the expected text anywhere near an agent prompt.
6. Claim it: post the comment from
   ```bash
   node "$SCRIPTS/coordinate.mjs" --op make-comment --kind claim \
     --dim <dim> --batch <B> --run <r> --nonce <nonce> --mode <pickable> \
     --group-lines <g> --group-files <g> [--focus "<hint>"]
   ```
   Wait ~10s, re-dump, re-run `run-status --my-nonce`: `ownedByMe=false` →
   post `void` (make-comment), back to step 4 for the next candidate. From
   here on, EVERY abort path posts `void` before exiting.
7. Strict agent-output validation:
   - StructuredOutput/schema options are steering only. Every scan/refute
     result MUST be serialized to a temp JSON file and validated locally:
     ```bash
     node "$SCRIPTS/validate-agent-output.mjs" --schema scan \
       --file "$RUN_TMP/scan-g<G>.raw.json" --group "$RUN_TMP/group-g<G>.json" \
       --repo "$WT" --rules <rules-file-if-local> \
       --out "$RUN_TMP/scan-g<G>.json"
     node "$SCRIPTS/validate-agent-output.mjs" --schema refute \
       --file "$RUN_TMP/refute-g<G>-f<N>.raw.json" \
       --out "$RUN_TMP/refute-g<G>-f<N>.json"
     ```
   - On validation failure, send the validator stderr plus the raw output back
     to the SAME agent label with a repair prompt: "Your previous answer failed
     schema validation. Return corrected raw JSON only. Do not add prose or
     markdown fences." Retry at most twice. If it still fails, treat the group
     as NO scan result (step 9b); never checkpoint invalid output.
   - Probe validation belongs here too. If probe text does not match the
     pinned worktree, the scan output is invalid and must be repaired/rerun
     before findings are trusted.
8. Scan groups — **ultracode**: orchestrate with the Workflow tool (template
   below); the skill mandates multi-agent orchestration and counts as the
   user's explicit opt-in. Only if the Workflow tool is genuinely absent,
   fall back to direct Agent fan-out capped at
   `config.defaults.maxConcurrentAgents`. Per group: scan agent → refute
   findings whose severity ∈ `config.defaults.verifySeverities` → post the
   checkpoint COMMENT on the RUN page (body generated by
   `make-comment --kind ckpt`, which embeds your claim nonce — the heartbeat
   is nonce-attributed).
9. Reconcile — re-dump the run page comments, then:
   ```bash
   node "$SCRIPTS/coordinate.mjs" --op reconcile \
     --plan "$RUN_TMP/groups.json" --comments <run dump> \
     --my-nonce <nonce> --table "$RUN_TMP/runs.json" --run <r> \
     [--have-results "<group ids with validated results>"]
   ```
   `takenOver=true` → STOP silently (protocol). Otherwise execute the
   per-group `action`s:
   a. `repost-checkpoint` (results exist, comment missing) → post it now from
      the orchestrator's data (make-comment --kind ckpt).
   b. `rerun-once` (no scan result — agent died/timeout) → re-run that group
      once (scan + verify + checkpoint). Never fabricate a checkpoint.
   c. PROBE verification — backstop only: the step-7 validator already
      verifies probes (`--repo`). Apply by hand (compare probe text via
      `sed -n '<N>p' "$WT/<path>"`, whitespace-trimmed) only for the direct
      Agent fallback or orchestrator-reposted checkpoints whose validation
      could not run. Wrong or missing probe → treat exactly like 9b (re-run
      once).
   Re-dump and re-run `reconcile` after the actions; loop until
   `actionsPending=false` or every rerun has had its one retry. The final
   output's `closeArgs` (missingIdx + lines) feeds step 10 verbatim.
10. Close the run (protocol order), everything generated — nothing
    hand-written:
    a. Report body: `--op make-report --comments <re-dumped run page>
       --state … --table … --run <r> --mode <mode> --nonce <nonce>
       --plan "$RUN_TMP/groups.json" [--details <validated scan
       outputs>] --missing-idx <closeArgs.missingIdx> --refuted <n>
       --closed-runs <k+1> --run-count <runCount>` → write it into the RUN
       PAGE BODY (`updateConfluencePage`). It aggregates ALL checkpoints on
       the page — a takeover report includes the dead runner's groups.
       (make-report re-folds the dump; a takeover at this instant surfaces
       as reconcile/run-status `takenOver` — re-check if any time passed.)
    b. Close comment: `make-comment --kind close --missing-idx
       <closeArgs.missingIdx> --lines <closeArgs.lines>`.
    c. If the batch page dump from step 3 had no fence: index comment
       (`make-comment --kind run-closed`, best-effort).
    d. Slack (best-effort; skip iff reconcile's `slackDedup` or
       `config.slack.notify=false`): line from `make-comment --kind
       slack-run --range "<start>,<end>" --p0 … --closed-runs <k+1>
       --run-count <runCount> --url <run page URL> [--missing-idx …]`.
11. Reply to the user: range covered, batch progress (`已关 k/runCount`,
    covered-lines % from the engine), P0/P1 counts with one-line examples,
    run page link, `missingIdx` warning if non-empty, next-step hint (more
    parallel sessions can claim remaining runs).
12. Re-dump the batch index; if it now shows every table run closed-complete
    → run the authoritative gate (Flow E step 2) and continue into Flow E NOW
    (the worktree is still needed). Otherwise optionally
    `git worktree remove --force "$WT"` (skip in cloud sandboxes — ephemeral
    anyway; skip when other local sessions may share `$WT`).

## Flow E: batch summary

Route in: every table run closed with empty `missingIdx` and
`summaryPageId == null` (fresh invocation or Flow D step 12).

1. Acquire the batch-level state lock
   (`--op state --transition lock --flow summarizing --nonce …`; write, wait
   ~5s, re-read, verify nonce). Flow D does NOT hold this lock, so always
   acquire it here.
2. Re-verify completeness AUTHORITATIVELY: dump every table run page's
   comments into a directory as `r<NNN>.json`, then
   ```bash
   node "$SCRIPTS/coordinate.mjs" --op batch-status --table "$RUN_TMP/runs.json" \
     --runs-dir "$RUN_TMP/run-dumps" [--legacy-run <n> --legacy-cursor <n>] \
     --total-lines <state.totalLines>
   ```
   `complete=false` → release the lock (`--transition unlock`) and report
   `openRuns` verbatim. Surface `waived` files — they go into the summary's
   未覆盖 list.
3. Materialize the pinned tree (a fresh sandbox arriving here has nothing).
   Also `git fetch origin <config.mainBranch>` and keep
   `LATEST=$(git rev-parse FETCH_HEAD)`; read current-x file content via
   `git show ${LATEST}:<path>` (no second worktree needed).
4. Collect ALL checkpoint comments from every RUN page (loop the run table's
   `pageId`s). For a retrofitted batch (`legacyCursor > 0`), ALSO collect the
   legacy checkpoints from the batch page comments. Unescape, parse, flatten.
5. Dedup key: `path + category + floor(line/30)`. Merge duplicates (keep
   highest severity/confidence).
6. Cluster by module (top 2–3 path segments). Per cluster, spawn a reviewer
   agent (**ultracode**: fan these out with the Workflow tool too): confirm
   each finding in `$WT` (refresh line refs), then check
   `git show ${LATEST}:<path>` — gone on latest x → `fixedOnMain: true`.
7. Previous batch comparison: read `prevSummaryPageId` (its trailing compact
   JSON block) → label findings new / recurring / fixed.
8. Create the summary page (child of the batch page, idempotency rule on
   retry, template below; body ends with the compact open-findings JSON
   block, plus a 未覆盖 section when `waived` is non-empty). Slack notify one
   line from `make-comment --kind slack-summary` (respect
   `config.slack.notify`).
9. Release-update the state page via
   `--op state --transition close-summary --summary-page-id <id>` (sets
   `summaryPageId`, unlocks); refresh the progress snapshot in the body.
   Remove the temp worktree. The next invocation routes to Flow C.

## Flow F: rebuild (`/1k-cycle-scan <dim> rebuild`)

Destructive: abandons the current batch's remaining coverage. Requires
explicit user confirmation in-conversation (state the current batch, closed
runs/runCount, in-flight claims if any, and that unscanned files will only be
covered by the NEXT batch's blueprint). Then:

1. Acquire the batch-level state lock
   (`--op state --transition lock --flow rebuilding --nonce …`).
2. Post the `batch-closed` fence comment on the old batch page
   (`make-comment --kind batch-closed --reason forcedRebuild`) and append a
   `forcedRebuild · abandoned at <k>/<runCount> runs` panel to its body.
   In-flight runners will waste their slice at most — they only write their
   own run pages.
3. Execute Flow C steps 2–11 under the held `rebuilding` lock (the
   `open-batch` transition accepts it — no unlock/relock window). Note
   `forcedRebuild` on the new batch page. Do NOT create a summary for the
   abandoned batch.

## Scan agent prompt (per group)

```
You are scanning OneKey monorepo source files for <dimension> issues.
Repo checkout (read-only): <WT> at commit <PIN>.

1. Read the rules checklist FULLY first: <rules location — file path, or
   inline content for page-sourced rules>. Respect its false-positive guards
   and severity framework.
2. Read each assigned file COMPLETELY (paths relative to <WT>):
   <path (lines)[, probe line N]> ...
   READ MECHANICS: a single Read call returns at most ~2000 lines. For longer
   files, continue with increasing offsets until the stated line count is
   fully covered. Never skim, sample, or stop early.
   READ PROBES: for every file marked "probe line N", include the EXACT text
   of that line in your probes output. Probes are verified against the repo;
   a wrong or missing probe invalidates this whole group and it gets
   rescanned.
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
4. Return raw JSON only, exactly matching the schema below. Do not wrap it in
   markdown fences, do not add prose, and do not add extra keys. `evidence`
   and `suggestion` are required for every finding.
<focus hint from the user's trailing free text, if any>
```

Finding schema (Workflow `schema` option / StructuredOutput, then mandatory
local `validate-agent-output.mjs --schema scan`):

```json
{ "type": "object", "additionalProperties": false, "required": ["findings", "probes"], "properties": {
  "findings": {
  "type": "array", "items": { "type": "object",
    "additionalProperties": false,
    "required": ["path", "line", "category", "severity", "title", "evidence", "suggestion", "confidence"],
    "properties": {
      "path": { "type": "string" }, "line": { "type": "integer", "minimum": 1 },
      "category": { "type": "string" },
      "severity": { "enum": ["P0", "P1", "P2"] },
      "title": { "type": "string", "description": "one line, ≤120 chars, no angle brackets/URLs" },
      "evidence": { "type": "string", "description": "≤3 code lines" },
      "suggestion": { "type": "string", "description": "one line" },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 } } } },
  "probes": { "type": "array", "description": "one entry per assigned file marked with a probe line",
    "items": { "type": "object", "required": ["path", "line", "text"],
      "additionalProperties": false,
      "properties": { "path": { "type": "string" }, "line": { "type": "integer", "minimum": 1 },
        "text": { "type": "string", "description": "exact content of that line" } } } } } }
```

Refuter prompt (each finding with severity ∈ `config.defaults.verifySeverities`):
*"Adversarially verify this finding — read <path> around line <line> in <WT>
plus enough context to judge. Finding: <title / evidence>. Rules context:
<category excerpt>. Default to refuted when uncertain. Return raw JSON only:
{\"refuted\": boolean, \"reason\": string}. No markdown fences or extra
keys."* Refuter output is then validated with
`validate-agent-output.mjs --schema refute`. Refuted → drop from checkpoint,
count in the report.

## Workflow template (adapt, don't copy blindly)

```js
export const meta = { name: 'cycle-scan-run', description: 'Scan one claimed run',
  phases: [{ title: 'Scan' }, { title: 'Verify' }] }
// args: { groups, wt, pin, dimension, rulesLocation, rulesFile, focus,
//         cloudId, runPageId, batch, runNumber, claimNonce, verifySeverities,
//         scriptsDir }
// Defensive: depending on the harness, `args` may arrive JSON-stringified.
const ARGS = typeof args === 'string' ? JSON.parse(args) : args
// Template-literal gotcha: to emit ```json fences inside prompts, use a
// FENCE const ('``' + '`') — raw backticks terminate the template literal.
async function strictAgent({ prompt, label, phase, schemaName, schema, validateArgs }) {
  let raw = await agent(prompt, { label, phase, schema })
  // Validates original + repair1 + repair2; after the second failed repair,
  // give up WITHOUT spending another agent call ("retry at most twice").
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const validation = await validateWithLocalScript({
      script: `${ARGS.scriptsDir}/validate-agent-output.mjs`,
      schemaName,
      raw,
      validateArgs,
    })
    if (validation.ok) return validation.value
    if (attempt === 2) break
    raw = await agent(
      repairPrompt({ originalPrompt: prompt, raw, errors: validation.stderr }),
      { label: `${label}:repair${attempt + 1}`, phase, schema },
    )
  }
  return null
}
const results = await pipeline(
  ARGS.groups,
  (g) => strictAgent({
    prompt: scanPrompt(g),
    label: `scan:g${g.id}`,
    phase: 'Scan',
    schemaName: 'scan',
    schema: FINDINGS,
    validateArgs: { group: g, repo: ARGS.wt, rules: ARGS.rulesFile },
  }),
  async (res, g) => {
    if (!res) return null
    const verdicts = await parallel(
      res.findings.filter((f) => ARGS.verifySeverities.includes(f.severity)).map((f) => () =>
        strictAgent({
          prompt: refutePrompt(f),
          label: `refute:g${g.id}`,
          phase: 'Verify',
          schemaName: 'refute',
          schema: VERDICT,
          validateArgs: {},
        })
          .then((v) => ({ f, refuted: v?.refuted ?? false }))));
    const refutedSet = new Set(verdicts.filter(Boolean).filter((v) => v.refuted).map((v) => v.f))
    const kept = res.findings.filter((f) => !refutedSet.has(f))
    // best-effort in-flight checkpoint; orchestrator reconciles afterwards
    // (playbook Flow D step 9)
    await agent(checkpointPrompt(g, kept, ARGS), { label: `ckpt:g${g.id}`, phase: 'Verify' })
    return { group: g.id, idx: g.files.map((x) => x.i), kept, probes: res.probes,
      refuted: res.findings.length - kept.length }
  })
return { results }  // keep nulls: a null slot = group with NO result (step 9b)
```

`validateWithLocalScript` is a harness adapter, not model logic: write `raw`
to a temp JSON file, write `validateArgs.group` to a temp group file when
present, run `node <scriptsDir>/validate-agent-output.mjs --schema <scan|refute>
--file <raw> ...`, then parse the validator's normalized `--out` JSON.
`repairPrompt` must include the original prompt, the raw failed output, and the
validator stderr; it must ask for corrected raw JSON only. If a page-sourced
rules checklist is used, write it to a temp file and pass that file as
`rulesFile`; otherwise omit `--rules`.

`checkpointPrompt` instructs a minimal agent to (1) write the kept findings
to a temp JSON file, (2) generate the comment body with
`node ARGS.scriptsDir/coordinate.mjs --op make-comment --kind ckpt --dim …
--batch … --run ARGS.runNumber --group <g> --nonce ARGS.claimNonce --idx
"<i,i,…>" --lines <n> --findings-file <tmp>` (never hand-format the marker or
payload), then (3) load
`mcp__claude_ai_Atlassian__createConfluenceFooterComment` via ToolSearch and
post that body on `ARGS.runPageId` (the claimed RUN page, NOT the batch page)
with `ARGS.cloudId`. If unsure it succeeded, say so — the orchestrator's
reconciliation re-posts.

## Report templates

Reports are written in CHINESE (the user-facing deliverable); keep code
identifiers, paths, category keys, markers, and JSON in English.

Run page placeholder body (created by Flow C, replaced at close):

```markdown
状态:待认领
计划范围:manifest [<start>, <end>) — <files> 个文件,约 <lines> 行
认领方式:在本页评论区发 claim 评论(协议见 persistence-protocol.md);
checkpoint、close 评论也都发在本页。
```

Run report — GENERATED by `coordinate.mjs --op make-report` (this template is
the rendering spec, not something to hand-write; pass `--details` with the
validated scan outputs so 证据/建议 lines appear for this session's groups).
REPLACES the run page body at close via `updateConfluencePage`:

```markdown
| | |
|---|---|
| 日期 / commit | <date> / `<pin sha12>` |
| 本轮范围 | manifest [<start>, <end>) — <files> 个文件,<lines> 行 |
| 批次进度 | 本轮关闭后已关 <k>/<runCount> run(约 <Y>% 行) |
| 发现 | P0 <n> · P1 <n> · P2 <n>(本次执行驳回 <n> 个;继承组不可统计) |
| 执行 | <scan|repair|takeover> · claim <nonce> |
| 本轮关注点 | <用户附加提示词,或 —> |
| 缺失分组 | <无,或 missingIdx 对应的 group 与文件数> |

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
Pinned `<sha12>` · <runCount> 轮 · <files>/<lines> 全覆盖(100%)· <起止日期>

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
