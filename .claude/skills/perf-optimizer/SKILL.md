---
name: perf-optimizer
description: "Systematic performance optimization and regression debugging for OneKey mobile app (iOS). Use when: (1) Fixing performance regressions - when metrics like tokensStartMs, tokensSpanMs, or functionCallCount have regressed and need to be brought back to normal levels, (2) Improving baseline performance - when there's a need to optimize cold start time or reduce function call overhead, (3) User requests performance optimization/improvement/debugging for the app's startup or home screen refresh flow."
---

# Performance Optimizer

Systematic workflow for diagnosing and fixing performance issues in the OneKey mobile app using the perf-ci infrastructure and performance-server tooling.

## Overview

This skill provides a structured iterative approach to:
- Establish performance baselines from existing sessions
- Run controlled perf measurements (3 runs, median aggregation)
- Analyze session data to identify bottlenecks
- Make targeted code changes
- Verify improvements against thresholds
- Document all changes and results

**Key Metrics:**
- `tokensStartMs`: Time when Home tokens refresh starts (lower is better)
- `tokensSpanMs`: Duration of Home tokens refresh (lower is better)
- `functionCallCount`: Total function calls during session (lower is better)

**Success Criteria:**
- ✅ **SUCCESS**: Time metrics improve by ≥10%
- 🌟 **MINOR_IMPROVEMENT**: Time unchanged but function calls reduce by ≥20% (safe, small-scope changes)
- ❌ **NO_IMPROVEMENT**: Neither threshold met → revert changes

## Workflow

### Phase 1: Setup and Baseline

#### Step 1.1: Select Baseline Session

Ask user to choose a baseline session or help them select one:

```bash
# List recent sessions with key metrics
cat ~/perf-sessions/sessions.overview.jsonl | \
  jq -r '[.sessionId, .createdAt, .marks["Home:refresh:done:tokens"]] | @tsv' | \
  tail -20
```

User can specify:
- A known good session (for regression fixes)
- A recent session (for improvement work)
- Let you choose a representative session

#### Step 1.2: Analyze Baseline

Extract baseline metrics from the session:

```bash
# Get detailed analysis
node development/performance-server/cli/derive-session.js <baseline-sessionId> \
  --pretty \
  --output /tmp/perf-baseline-derived.json
```

Read baseline metrics from `~/perf-sessions/<sessionId>/mark.log`:

```bash
# Extract tokensStartMs (timestamp of Home:refresh:start:tokens)
grep "Home:refresh:start:tokens" ~/perf-sessions/<sessionId>/mark.log | jq '.timestamp'

# Extract tokensSpanMs (done - start)
grep "Home:refresh:done:tokens" ~/perf-sessions/<sessionId>/mark.log | jq '.timestamp'

# Count function calls
wc -l < ~/perf-sessions/<sessionId>/function_call.log
```

Create baseline metrics JSON for comparison:

```bash
echo '{"tokensStartMs": <start>, "tokensSpanMs": <span>, "functionCallCount": <count>}' > /tmp/baseline-metrics.json
```

#### Step 1.3: Initialize Documentation

Create session document at `development/output/perf-optimization-<timestamp>.md` using the template from `references/template.md`. Fill in:
- Current date/time
- Baseline session ID
- Baseline metrics
- Current branch name
- Target (regression fix or improvement)

### Phase 2: Iterative Optimization Loop

**Maximum iterations: 10**

For each iteration (run in a sub-agent):

#### Step 2.1: Run Performance Tests

The perf script **automatically runs 3 times** and aggregates results:

```bash
node development/perf-ci/run-ios-perf-detox-release.js
```

Output location: `development/perf-ci/output/<jobId>/`
- `report.json` - Contains aggregated results in `agg` field
- `detox/runs.json` - Contains individual run sessionIds

Extract current metrics from `report.json`:

```bash
# Read aggregated metrics directly
cat development/perf-ci/output/<jobId>/report.json | jq '{
  tokensStartMs: .agg.tokensStartMs,
  tokensSpanMs: .agg.tokensSpanMs,
  functionCallCount: .agg.functionCallCount
}' > /tmp/current-metrics.json
```

#### Step 2.2: Analyze Current Performance

For deeper analysis, run derive-session on individual sessions:

```bash
# Get sessionIds from the run
SESSIONS=$(cat development/perf-ci/output/<jobId>/detox/runs.json | jq -r '.runs[].sessionId')

# Analyze each session
for sid in $SESSIONS; do
  node development/performance-server/cli/derive-session.js $sid \
    --pretty \
    --output /tmp/perf-derived-$sid.json
done
```

Focus on these sections in the derived output:
- **slowFunctions**: Functions taking the most cumulative time
- **homeRefreshTokens**: What's consuming time in the critical refresh window
- **jsblock**: Main thread blocks causing delays
- **repeatedCalls**: Thrashing patterns or excessive re-renders
- **keyMarks**: Critical milestone timing

Identify top 1-3 bottlenecks that are:
- Taking significant time
- Potentially optimizable
- Within the critical path (Home refresh flow)

#### Step 2.3: Determine Action

Compare current metrics to baseline:

```bash
# Quick comparison
cat /tmp/baseline-metrics.json
cat /tmp/current-metrics.json

# Calculate deltas manually or use script in skill directory
```

**Decision tree:**

If current metrics show improvement over baseline:
- ✅ **SUCCESS** (≥10% time improvement) → **STOP**, document success
- 🌟 **MINOR_IMPROVEMENT** (≥20% function call reduction, time stable) → Create branch, commit, return to main branch, continue

If no improvement yet:
- Continue to Step 2.4 (make changes)

If iteration count reaches 10:
- Document findings and stop

#### Step 2.4: Make Code Changes

Based on analysis, make **ONE** targeted change per iteration:

**Change types:**
1. **Optimization**: Remove redundant work, cache results, reduce allocations
2. **Add perfMark**: Add marks to understand unclear bottlenecks better
3. **Both**: Add marks + optimize in same area

**Guidelines:**
- One change at a time (unless analysis proves multiple changes must work together)
- Small, focused changes
- Safe changes only (never break functionality)
- Document rationale clearly

**Adding perfMarks:**

Use the performance utilities in `packages/shared/src/performance/`:

```typescript
import { perfMark } from '@onekeyhq/shared/src/performance/perfMark';

// Add mark at a specific point
perfMark('MyComponent:operation:start');
// ... operation ...
perfMark('MyComponent:operation:done');
```

Naming convention: `<Component>:<action>:<phase>` (e.g., `Home:refresh:start:tokens`)

**If adding perfMarks for investigation:**
1. Add marks around suspected bottleneck
2. Run one perf cycle with marks
3. Analyze new data with marks visible
4. Then make code optimization
5. Verify with another perf cycle

#### Step 2.5: Document Iteration

Update the session document with:
- **Analysis**: Job ID, session IDs, median metrics, key findings from derive-session
- **Code Changes**: File, location, change type, description, rationale
- **Verification Results**: New job ID, metrics, deltas vs previous/baseline, verdict, action taken

### Phase 3: Finalization

#### Step 3.1: Handle MINOR_IMPROVEMENT Branch

If any iterations resulted in MINOR_IMPROVEMENT:

```bash
git checkout -b perf/minor-<description>
git add <changed-files>
git commit -m "perf: <description>

Reduces function call count by X% while maintaining time metrics.

Reason: <brief explanation>
"
git checkout <original-branch>
git restore .
```

Document the branch name in the session document.

#### Step 3.2: Complete Documentation

Fill in the Summary section:
- Total iterations run
- Final result (SUCCESS with % improvement, or still investigating)
- List all effective changes
- List all ineffective changes with reasons
- List any branches created
- Next steps if incomplete

## Key Files and Paths

**Perf Infrastructure:**
- `development/perf-ci/run-ios-perf-detox-release.js` - Main perf runner
- `development/perf-ci/output/<jobId>/` - Job output directory
- `development/performance-server/cli/derive-session.js` - Session analyzer
- `~/perf-sessions/` - Session data storage (default)
- `~/perf-sessions/sessions.overview.jsonl` - Session index

**Thresholds:**
- `development/perf-ci/thresholds/ios.release.json` - Release mode thresholds

**Performance Utilities:**
- `packages/shared/src/performance/perfMark.ts` - Performance marking utility

## References

- **references/template.md**: Session documentation template
- **references/perf_tool_guide.md**: Detailed guide to derive-session and analysis tools

## Important Notes

1. **Run each optimization loop in a sub-agent** to avoid context bloat
2. **Never commit changes unless** SUCCESS or MINOR_IMPROVEMENT
3. **Always document failed attempts** - helps avoid repeating ineffective changes
4. **Trust the data** - if metrics don't improve, revert even if change "should" help
5. **Be patient** - each perf run takes significant time (build + 3 runs); rushing leads to mistakes
6. **Focus on the critical path** - Home screen tokens refresh is the key metric
7. **Watch for trade-offs** - some optimizations might reduce one metric but increase another
