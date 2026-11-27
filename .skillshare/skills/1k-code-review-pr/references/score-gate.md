# Review Score Gate (`review-score-gate.js`)

Deterministic PR characterization verification, quantitative signal scoring, and score-driven inline publishing gate for `1k-code-review-pr`.

## CLI Usage

```bash
node development/scripts/review-score-gate.js evaluate \
  --input /tmp/pr-<N>-review-draft.json \
  --context /tmp/pr-<N>-context.json \
  --mode soft \
  --diff /tmp/pr-<N>.diff \
  --repo . \
  --out-json /tmp/pr-<N>-review-validated.json \
  --out-md /tmp/pr-<N>-score-appendix.md
```

### Progressive Rollout Modes (`--mode`)
- **`shadow`** (pilot week 1–2): Fail-open (`exit 0`), passes all anchored candidates through while recording side-by-side gate scores and separating unanchored items so GitHub API calls never 422.
- **`soft`** (default): Fail-open (`exit 0`), auto-corrects mismatched PR characterization using observed signals, preserves non-speculative high-risk P0s via safety valve, and folds filtered findings into a collapsible `<details>` audit drawer so zero findings are silently lost.
- **`strict`**: Requires independently collected `--context` and an explicit `findings` array; exits with code `2` **before** writing any output files on invalid JSON, context mismatch, or characterization mismatch.

## Input Schemas

### `--context` (`pr-context.json`)
Collected independently (compatible with `gh pr view --json number,title,body,headRefOid,labels,files`):
- `prNumber` (or `number`): PR number (source of truth; conflicts with draft raise `E_CONTEXT_MISMATCH`)
- `headSha` (or `headRefOid`): PR head commit SHA (source of truth)
- `title`, `body`: PR title and description
- `labels`: `string[]` or `Array<{ name: string }>`
- `files`: `string[]` or `Array<{ path: string }>`
- `existingAutoThreadCount`, `reviewRound`, `existingThreads` (`Array<{ id, isResolved, path, title?, body? }>`)

### `--input` (`review-draft.json`)
Produced by the reviewer:
- `characterization`: `{ type: "revert" | "deps_or_ci" | "cross_platform_migration" | "core_feature" | "targeted_bugfix" | "general", summary: string, focusAreas: string[] }`
- `findings`: array of `{ severity: "P0"|"P1"|"P2", confidence: "🔵 High"|"🟠 Medium"|"⚪ Low" (or "high"|"medium"|"low"), category, file, line, anchorFile?, anchorLine?, isPreExisting?, existingThreadId?, title, problem, impact?, suggestedFix?, autoFix?, evidence: { inDiff?, executionPath?, reproduction?, existingReuseTargets?, codeReferences? } }`
- Valid `category` values: `security`, `funds_loss`, `crash`, `build_registry`, `cross_platform_divergence`, `half_migration`, `code_duplication`, `concurrency_race`, `data_corruption`, `runtime_boundary`, `memory_leak`, `error_handling`, `performance`, `edge_case`, `a11y_or_motion`, `ui_polish`, `style_nit`.

## Scoring Model & Publishing Rules

$$\text{SignalScore} = \text{clamp}_{0..100}\big(\text{BaseImpact} \times \text{TypeAlignment} + \text{EvidenceScore} - \text{NoisePenalty}\big)$$

1. **`BaseImpact × TypeAlignment`**: Looks up `PR type × finding category` alignment. On non-a11y PRs, English/Chinese `a11y_or_motion` nitpicks (VoiceOver/TalkBack/屏幕阅读器/Reduce Motion/focus ring/折叠屏铰链) are automatically reclassified and down-weighted (`8 × 0.2`); on explicit `a11y` PRs they are elevated (`32 × 1.5`).
2. **`EvidenceScore` (0–40)**: Verifies exact `file:line` (or `anchorFile:anchorLine`) falls inside real `git diff` hunks (`+15`), explicit `executionPath`/`reproduction` (`+15`), and verified repo file references inside `repoRoot` (`+10`).
3. **`NoisePenalty`**: Penalizes speculative English/Chinese questions without concrete proof (`-25`), pre-existing issues (`-30`), and follow-up round P2 spirals (`-35`). Matching unresolved existing threads are routed to `REPLY_THREAD` (`duplicateOfThreadId`) rather than penalized or dropped.
4. **Score-Driven Inline Publishing (No Arbitrary Comment Cap)**:
   - `PUBLISH`: requires eligibility (`P0` any confidence, or `P1` with `high` confidence), valid diff line anchor (or `REPLY_THREAD` match), and `SignalScore >= 70` (`P0 >= 55`). Every qualifying finding is published.
   - `SUMMARY_ONLY`: `50 <= SignalScore < 70`, or eligible findings without a valid inline diff anchor, or high-scoring `P2`s.
   - `DROP`: `SignalScore < 50` or unproved speculative questions (folded into `<details>` audit drawer).
   - `--out-md` renders a `### 量化门禁评分附录` appendix complementing the Unified Report Format.
