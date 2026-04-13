# PRD: Benchmark-Driven Skill Optimization for OneKey CLI

## Introduction

Use the open-source [crypto-skill-benchmark](https://github.com/user/crypto-skill-benchmark) framework to systematically evaluate and optimize OneKey CLI's SKILL.md files. The benchmark sends each SKILL.md as an LLM system prompt, simulates user intents from 76 curated scenarios, and scores responses across 5 dimensions (Safety, Coverage, Robustness, Routing, UX) using an LLM-as-Judge pipeline.

**The core loop:** Run benchmark against a skill → stop on first failure → analyze root cause → fix SKILL.md → re-run → repeat until all applicable scenarios pass. Unsupported scenarios are documented and skipped with justification.

## Goals

- Achieve quality score **80+/100** with **Safety Gate PASS** for each OneKey CLI skill
- Establish a reproducible evaluate-fix-verify loop that can be run locally
- Document which benchmark scenarios are not applicable to OneKey CLI and why
- Produce optimized SKILL.md files that score well on all 5 dimensions:
  - Safety (30%): Confirmation flows, amount accuracy, credential protection
  - Coverage (25%): Breadth of supported operations
  - Robustness (20%): Adversarial input handling, graceful degradation
  - Routing (15%): Intent-to-command mapping precision
  - UX (10%): Output completeness (action, tokens, amount, chain, recipient, next steps, warnings)

## Core Principles

### 1. SKILL.md stays lean
- Only essential security rules and behavioral constraints
- Command details self-documented via `onekey schema --list` and `onekey schema <cmd>`
- No routing tables, UX checklists, or speculative structure — only add what a failing scenario demands
- No `references/` directory

### 2. Scenario-driven iteration
- Run ONE core scenario → analyze failure → make MINIMAL fix to SKILL.md → verify → next scenario
- Never pre-add structure speculatively
- Each fix must be justified by a specific scenario failure
- Order: core basic tier first, then core intermediate, then adversarial

### 3. Benchmark LLM constraint
The benchmark LLM cannot execute commands — it only reads SKILL.md text. So SKILL.md must list command names and brief descriptions for routing, but NOT full schemas. The CLI's `onekey schema` command handles parameter discovery at runtime.

## User Stories

See `tasks/prd.json` for the full story list (29 stories).

### Execution Order (single-skill focus)

Each scenario runs against its **owning skill only** — 1 scenario = 1 benchmark run.

**Phase 1 — Swap skill (US-001 ~ US-009)**
1. swap-basic → multi-turn-swap-confirm → multi-turn-swap-abort
2. swap-convert-pair → swap-meme-coin → swap-sell-direction
3. multi-chain-swap → multi-turn-swap-modify-amount → token-by-contract

**Phase 2 — Wallet skill (US-010 ~ US-016)**
4. balance-check → portfolio-check → send-tokens
5. transfer-with-chain → multi-turn-transfer-chain-clarify
6. deposit → withdraw

**Phase 3 — Market skill (US-017 ~ US-027)**
7. price-check → trending-tokens → discover-token-search
8. ask-quick-analysis → research-comparison → research-deep-dive
9. fear-greed-index → btc-metrics
10. stock-ticker-vs-token → multi-turn-research-to-trade → research-then-trade

**Phase 4 — Edge cases (US-028 ~ US-029)**
11. limit-order → multi-turn-limit-order-modify (swap skill, may be N/A)

**Phase 5 — Wrap up (US-030 ~ US-031)**
12. Document unsupported scenarios
13. Full regression — each skill against its own scenarios

### Per-Scenario Loop

Each scenario runs against the **owning skill only**.

```
For each scenario:
  1. Run: npm run dev -- evaluate <owning-skill-dir> --scenario-file <scenario.yaml>
  2. If score >= 75/100 → PASS
  3. If score < 75/100:
     a. Read judge reasoning from report
     b. Identify what SKILL.md is missing
     c. Make MINIMAL edit (only what this scenario needs)
     d. Re-run to verify fix
  4. If scenario is fundamentally unsupported → document in unsupported-scenarios.md
  Move to next scenario
```

## Functional Requirements

- FR-1: Build crypto-skill-benchmark locally and execute via `npm run dev`
- FR-2: Point the benchmark at local OneKey skill directories (no registry pull needed)
- FR-3: Run single-scenario evaluations via `--scenario-file` for iterative debugging
- FR-4: Run evaluations filtered by tier (`--tier basic`, `--tier intermediate`, `--tier adversarial`)
- FR-5: Use `--compare` flag to track score deltas between iterations
- FR-6: Analyze per-scenario judge output to identify specific SKILL.md gaps
- FR-7: Edit SKILL.md files only (no CLI tool code changes in this effort)
- FR-8: Document unsupported scenarios with justification
- FR-9: SKILL.md must instruct agents to use `onekey schema` for command discovery — no bundled schemas

## Non-Goals

- **NOT** modifying CLI tool code (commands, schemas, error handling) — only SKILL.md optimization
- **NOT** creating new custom scenarios for OneKey-specific features (deferred to future)
- **NOT** integrating into CI/CD pipeline (deferred until loop is validated)
- **NOT** forking or modifying the benchmark framework itself
- **NOT** optimizing for perpetual futures scenarios (OneKey CLI doesn't support perps)

## Technical Considerations

### Benchmark Execution

**Environment:** Local benchmark at `/Users/leon/Documents/github/crypto-skill-benchmark`, using custom API:
- Skill model: `gpt-5.4-mini` (via `llm-api.onekeytest.com`)
- Judge model: `gpt-5.4` (via `llm-api.onekeytest.com`)

**All commands run from the benchmark directory:**
```bash
cd /Users/leon/Documents/github/crypto-skill-benchmark
```

#### Single Scenario (primary workflow for iterative debugging)
```bash
# Run ONE scenario against ONE skill — the core iteration loop
npm run dev -- evaluate \
  /Users/leon/Documents/onekey/x-app-monorepo/apps/cli/skills/swap \
  --scenario-file /Users/leon/Documents/github/crypto-skill-benchmark/scenarios/core/swap-basic.yaml
```

#### Tier-based (batch validation after fixes)
```bash
# Run all basic-tier scenarios
npm run dev -- evaluate \
  /Users/leon/Documents/onekey/x-app-monorepo/apps/cli/skills/swap \
  --tier basic

# With comparison to last run
npm run dev -- evaluate \
  /Users/leon/Documents/onekey/x-app-monorepo/apps/cli/skills/swap \
  --tier basic --compare
```

#### Full evaluation (milestone scoring)
```bash
# All tiers, all scenarios
npm run dev -- evaluate \
  /Users/leon/Documents/onekey/x-app-monorepo/apps/cli/skills/swap
```

#### Batch (all skills)
```bash
npm run dev -- evaluate \
  /Users/leon/Documents/onekey/x-app-monorepo/apps/cli/skills/swap \
  /Users/leon/Documents/onekey/x-app-monorepo/apps/cli/skills/wallet \
  /Users/leon/Documents/onekey/x-app-monorepo/apps/cli/skills/market \
  /Users/leon/Documents/onekey/x-app-monorepo/apps/cli/skills/security
```

### Scenario Applicability Assessment

Based on the 76 scenarios, here's the expected applicability breakdown:

| Category | Total | Likely Applicable | Likely N/A | Reason for N/A |
|----------|-------|-------------------|------------|----------------|
| Fund Transfer Confirmation | 11 | 11 | 0 | OneKey supports swap + transfer |
| Token & Asset Identification | 4 | 4 | 0 | Token search/info supported |
| Scam Token Detection | 15 | 15 | 0 | Security audit covers this |
| Trading Pair & Chain | 7 | 5 | 2 | Multi-chain supported, some CEX-specific may not apply |
| Amount Accuracy | 4 | 4 | 0 | Human-readable amounts supported |
| Perpetual Futures | 11 | 0 | 11 | OneKey CLI has no perps |
| Research & Analysis | 7 | 5 | 2 | Market data supported, some research patterns may differ |
| Multi-Turn Conversations | 11 | 9 | 2 | Most apply, perps multi-turn N/A |
| Safety Edge Cases | 6 | 6 | 0 | All safety scenarios apply |

**Estimated:** ~59/76 scenarios applicable, ~17 N/A (mostly perps)

### SKILL.md Optimization Vectors

Based on the benchmark's 5 dimensions, likely areas to strengthen in SKILL.md files:

1. **Safety (30%)** — Explicit confirmation flow documentation, multi-turn confirmation separation, amount parsing rules
2. **Coverage (25%)** — May need to document what operations are NOT supported (graceful decline)
3. **Robustness (20%)** — Add explicit handling guidance for: fake tokens, wrong chains, phishing URLs, typosquatting, social engineering in multi-turn
4. **Routing (15%)** — Add intent-to-command mapping table, alias handling, multi-step decomposition rules
5. **UX (10%)** — Add output format checklist: must include action type, token names, amount, chain, recipient, next steps, warnings

### Cost Estimation

Uses custom API at `llm-api.onekeytest.com` — no OpenRouter costs. Cost is internal API usage only.

## Success Metrics

- All 4 skills achieve **quality score >= 80/100**
- All 4 skills achieve **Safety Gate PASS**
- Per-dimension thresholds met: Safety >= 90%, Routing >= 70%, Robustness >= 65%, Coverage >= 50%, UX >= 50%
- Unsupported scenarios documented with clear justification
- Reproducible local evaluation loop established (can re-run at any time)

## Resolved Questions

1. **Frontmatter:** Benchmark logs `[WARN] No YAML frontmatter found` but still runs. Add frontmatter to eliminate the warning.
2. **Skill consolidation:** No — 4 skills tested independently.
3. **Unsupported operations:** Yes — SKILL.md should explicitly state unsupported operations and suggest alternatives for better robustness scores.
4. **API costs:** Uses internal API (`llm-api.onekeytest.com`), no external budget needed.
5. **references/ directory:** Not used — skills rely on dynamic `onekey schema` discovery at runtime. SKILL.md contains command names and descriptions only.

## Open Questions

1. Should each SKILL.md declare which scenario categories it's designed to handle, to make it easier to select the right scenarios for each skill?
2. For the benchmark's `expected.correct_command` field (e.g., `minara swap`), how does the judge handle OneKey-specific command names (e.g., `onekey swap quote`)? Does it evaluate behavior or exact command strings?
