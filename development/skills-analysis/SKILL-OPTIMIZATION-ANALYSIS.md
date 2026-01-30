# Skill Optimization Analysis - 2026-01-30

## Executive Summary

Analyzed 3 large skills (>5k tokens) for potential splitting. **Recommendation: Keep all three intact** based on workflow coherence, topic correlation, and user experience considerations.

## Current State

### Skills Analyzed

| Skill | Tokens | Size | Files | Status |
|-------|--------|------|-------|--------|
| 1k-sentry-analysis | 9,394 | 37.9 KB | 1 | ⚠️ CONSIDER |
| 1k-feature-guides | 8,493 | 34.4 KB | 4 | ⚠️ CONSIDER |
| 1k-performance | 6,267 | 24.7 KB | 1 | ⚠️ CONSIDER |

## Detailed Analysis

### 1. 1k-sentry-analysis (9,394 tokens)

**Structure:**
- Single file: `fix-sentry-errors.md` (1,123 lines, 8,361 tokens)
- Linear workflow: Obtain JSON → Analyze → Root Cause → Bug Log → Fix → Verify → PR

**Sections:**
1. Workflow Overview
2. Step 1: Obtain Sentry JSON Log
3. Step 2: Analyze the Error (Python scripts, key info extraction)
4. Step 3: Identify Root Cause (stack traces, breadcrumbs)
5. Step 4: Generate Bug Analysis Log (largest section - template)
6. Step 5: Implement Fix (common fix patterns)
7. Step 6: Verify Fix
8. Step 7: Create PR
9. Best Practices
10. Common Scenarios
11. Troubleshooting

**Potential Split Options:**
- ❌ **Option A**: Split analysis tools (Python scripts) from fix patterns
  - **Problem**: Users need both for complete workflow
- ❌ **Option B**: Split by platform (iOS AppHang, Android ANR)
  - **Problem**: Workflow is platform-agnostic

**Decision: KEEP INTACT**

**Reasoning:**
1. ✅ **Workflow coherence**: Steps are sequential and interdependent
2. ✅ **High correlation**: Users analyzing Sentry errors need the complete workflow
3. ✅ **Single use case**: Clear trigger (analyzing Sentry errors)
4. ✅ **Reference value**: Bug analysis template is essential part of workflow

**Trade-off:**
- ⚠️ 9,394 tokens loaded every time
- ✅ But users get complete, coherent workflow without jumping between skills

---

### 2. 1k-performance (6,267 tokens)

**Structure:**
- Single file: `performance.md` (779 lines, 5,476 tokens)
- 8 optimization categories

**Section Sizes:**
| Category | Lines | % of Total |
|----------|-------|------------|
| List Rendering Optimization | 290 | 37% |
| Async Operation Patterns | 141 | 18% |
| Main Thread Protection | 73 | 9% |
| React Component Optimization | 58 | 7% |
| React Native Bridge | 51 | 7% |
| State Updates | 47 | 6% |
| Concurrent Request Control | 45 | 6% |
| Image Optimization | 24 | 3% |
| Other (checklist, examples, anti-patterns) | 50 | 7% |

**Potential Split Options:**
- ❌ **Option A**: Split List Rendering (290 lines) separately
  - **Problem**: List optimization is integral to performance work
- ❌ **Option B**: Split by category (React Native vs React Web)
  - **Problem**: Many apps use both; categories overlap

**Decision: KEEP INTACT**

**Reasoning:**
1. ✅ **Comprehensive optimization**: Performance work requires holistic view
2. ✅ **6,267 tokens acceptable**: Below 10k threshold, reasonable for topic breadth
3. ✅ **High interdependence**: Categories often used together (e.g., list + memoization)
4. ✅ **Quick Reference available**: SKILL.md provides category overview
5. ✅ **Natural grouping**: Users think "I need to optimize performance" not "I need list optimization"

**Enhancement Suggestion:**
- ✅ SKILL.md already has good Quick Reference showing all 8 categories
- ✅ Users can scan categories before diving into full file

---

### 3. 1k-feature-guides (8,493 tokens)

**Structure:**
- 4 files, varying sizes

**Files:**
| File | Lines | Size | Topic |
|------|-------|------|-------|
| page-and-route.md | 386 | 11 KB | Page & route creation |
| notification-system.md | 343 | 12 KB | Notification system |
| adding-socket-events.md | 201 | 5.6 KB | WebSocket events |
| adding-chains.md | 117 | 2.8 KB | Blockchain chains |

**Potential Split Options:**
- ❌ **Option A**: Each file becomes separate skill
  - **Problem**: Low correlation isn't true - often used together
- ❌ **Option B**: Split large files (page/notification) from small
  - **Problem**: Arbitrary division; all are "feature development"

**Decision: KEEP INTACT**

**Reasoning:**
1. ✅ **Related workflows**: All are feature development guides
2. ✅ **Frequent co-use**: Adding feature often involves pages + notifications + events
3. ✅ **No single file too large**: Largest is 386 lines, manageable
4. ✅ **Clear category**: "Feature guides" is intuitive grouping
5. ✅ **8,493 tokens manageable**: Below 10k threshold

**User Scenario:**
- Adding new DeFi feature: needs page + route + notification + socket events
- Adding new chain: needs chain guide + potentially page/route for UI
- **Splitting would force user to load 2-4 separate skills**

---

## Recommendations

### Immediate Actions

**None required for these 3 skills.** All should remain intact.

### Future Monitoring

**Set thresholds for re-evaluation:**

| Skill | Current | Re-evaluate at | Trigger |
|-------|---------|----------------|---------|
| 1k-sentry-analysis | 9,394 | >12,000 tokens | +30% growth OR new independent workflow added |
| 1k-performance | 6,267 | >10,000 tokens | +60% growth OR categories split into web/native |
| 1k-feature-guides | 8,493 | >12,000 tokens | +40% growth OR unrelated feature added |

### Split Priority: react-best-practices

**Urgent split needed**: react-best-practices (14,345 tokens, 45 files)

**Suggested split by category:**
1. `react-bundle` - Bundle optimization (barrel imports, preload)
2. `react-rendering` - Rendering optimization (hydration, memoization, transitions)
3. `react-async` - Async patterns (defer, await, Suspense, API routes)
4. `react-js-perf` - JS performance (cache, batch DOM, early exit, loops)
5. `react-client` - Client-side (event listeners, SWR)
6. `react-server` - Server-side (parallel fetching, streaming)

**Benefits:**
- Reduces token load from 14,345 to ~2,400 per category (83% reduction)
- Each category has distinct trigger words
- Low correlation between categories

---

## Key Learnings

### When NOT to Split (Lessons from This Analysis)

1. **Linear workflows**: Sentry analysis is step-by-step; splitting breaks flow
2. **Comprehensive guides**: Performance optimization needs holistic view
3. **Related features**: Feature guides are used together frequently
4. **Size < 10k tokens**: Below urgent threshold; splitting overhead not worth it
5. **No clear boundaries**: Can't find natural split points without breaking semantics

### When TO Split (From Previous Success)

1. **1k-coding-patterns → 6 skills**: Unrelated topics (date, i18n, error handling)
   - **Key**: Each topic completely independent
   - **Result**: 47-53% token savings

2. **1k-dev-workflows → 3 skills**: Distinct workflows (Sentry, test versions, lint)
   - **Key**: Used in different scenarios
   - **Result**: 80% token savings when not doing Sentry analysis

### Decision Framework

**Split if ALL of these are true:**
- [ ] File/skill >10KB OR multiple unrelated topics
- [ ] Topics have <50% usage correlation
- [ ] Topics have distinct trigger words
- [ ] Each split would be >2KB (worth overhead)
- [ ] Natural split boundaries exist

**Keep intact if ANY of these are true:**
- [x] Linear workflow / sequential steps
- [x] Topics frequently used together (>50% correlation)
- [x] Size <10k tokens AND topics are related
- [x] Splitting would break semantic coherence
- [x] Users think of it as single concept

---

## Token Savings Potential

### If We Split These 3 Skills

**Estimated savings per scenario:**

| Scenario | Current | After Split | Savings | Worth It? |
|----------|---------|-------------|---------|-----------|
| Sentry analysis | 9,394 | 8,000-9,000 | 5-15% | ❌ No - workflow breaks |
| Performance opt | 6,267 | 5,500-6,000 | 5-12% | ❌ No - need holistic view |
| Feature dev | 8,493 | 7,000-8,000 | 6-18% | ❌ No - used together |

**Minimal savings; high cost to user experience.**

### If We Split react-best-practices

| Scenario | Current | After Split | Savings | Worth It? |
|----------|---------|-------------|---------|-----------|
| Bundle optimization | 14,345 | ~2,400 | 83% | ✅ Yes |
| Rendering work | 14,345 | ~2,400 | 83% | ✅ Yes |
| Async patterns | 14,345 | ~2,400 | 83% | ✅ Yes |

**Massive savings; minimal UX cost (categories are independent).**

---

## Conclusion

The 3 "consider splitting" skills should **remain intact**. They represent coherent, related content that users need together. The current token consumption (5-9k per skill) is acceptable given the workflow coherence and comprehensive nature of the content.

**Priority**: Focus on splitting `react-best-practices` (14,345 tokens) for immediate impact.

**Long-term**: Monitor growth and re-evaluate when skills exceed 10-12k tokens.
