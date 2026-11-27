'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('path');

const {
  parseReviewDraftSafely,
  parseUnifiedDiffHunks,
  extractObservedProfile,
  verifyCharacterization,
  evaluateReview,
  buildPublishPayload,
  renderMarkdownReport,
} = require('./review-score-gate');

const REPO_ROOT = path.resolve(__dirname, '../..');

test('parseUnifiedDiffHunks parses changed right-side line ranges accurately', () => {
  const diff = [
    'diff --git a/packages/kit/src/foo.ts b/packages/kit/src/foo.ts',
    '--- a/packages/kit/src/foo.ts',
    '+++ b/packages/kit/src/foo.ts',
    '@@ -10,2 +10,5 @@',
    '+line10',
    '+line11',
    '+line12',
    '@@ -40,1 +43,2 @@',
    '+line43',
  ].join('\n');

  const hunks = parseUnifiedDiffHunks(diff);
  assert.deepEqual(hunks['packages/kit/src/foo.ts'], [
    { start: 10, end: 14 },
    { start: 43, end: 44 },
  ]);
});

test('verifies revert PR characterization and drops a11y/motion/hinge noise (calibrated on #14812 & #337)', () => {
  const prContext = {
    prNumber: 14_812,
    title: 'revert: restore previous app toast behavior',
    files: ['packages/kit/src/components/Toast/toast.tsx', 'yarn.lock'],
  };

  // Mismatched claim should fail verification
  const observed = extractObservedProfile(prContext);
  assert.equal(observed.isRevert, true);
  const badCheck = verifyCharacterization(
    { type: 'core_feature', summary: 'Toast feature', focusAreas: ['ui'] },
    observed,
  );
  assert.equal(badCheck.valid, false);
  assert.equal(badCheck.errors[0].code, 'E_CHARACTERIZATION_MISMATCH');
  assert.equal(badCheck.effectiveType, 'revert');

  // Even if LLM mislabels VoiceOver/keyboard/hinge as edge_case, score gate drops them on revert PR
  const result = evaluateReview(
    {
      prNumber: 14_812,
      characterization: {
        type: 'revert',
        summary: 'Revert toast UI changes to previous renderer',
        focusAreas: ['revert_completeness', 'lockfile_sync'],
      },
      findings: [
        {
          severity: 'P2',
          category: 'edge_case',
          file: 'packages/kit/src/components/Toast/toast.tsx',
          line: 42,
          title: 'Keep invisible toast controls out of keyboard navigation',
          problem:
            'Hidden toast controls can still receive keyboard focus when collapsed.',
          evidence: { inDiff: true, executionPath: 'tab key focus' },
        },
        {
          severity: 'P2',
          category: 'edge_case',
          file: 'packages/kit/src/components/Toast/toast.tsx',
          line: 80,
          title: 'Keep Android toasts inside one pane on a separating hinge',
          problem:
            'Foldable devices with a separating hinge may split toast width.',
          evidence: { inDiff: true, executionPath: 'foldable hinge layout' },
        },
        {
          severity: 'P1',
          category: 'build_registry',
          file: 'yarn.lock',
          line: 100,
          title:
            'Pin the renderer package version matching the reverted toast UI',
          problem:
            'package.json reverts the renderer API usage but yarn.lock still resolves the newer incompatible version.',
          evidence: {
            inDiff: true,
            executionPath: 'Runtime fails to find legacy toast export on boot',
          },
        },
      ],
    },
    prContext,
  );

  assert.equal(result.characterizationCheck.valid, true);
  assert.equal(result.counts.published, 1);
  assert.equal(result.published[0].effectiveCategory, 'build_registry');
  assert.equal(result.counts.dropped, 2);
  assert.equal(result.verdict, 'COMMENT');
});

test('scores high-leverage cross-platform architecture & duplication findings above threshold and drops speculative guesses (calibrated on #14814)', () => {
  const diff = [
    'diff --git a/packages/kit/src/views/Market/Holders.tsx b/packages/kit/src/views/Market/Holders.tsx',
    '--- a/packages/kit/src/views/Market/Holders.tsx',
    '+++ b/packages/kit/src/views/Market/Holders.tsx',
    '@@ -100,4 +100,20 @@',
    '+const patches = planNativeListPatches();',
    'diff --git a/packages/kit/src/views/Market/MarketDetailPager.native.tsx b/packages/kit/src/views/Market/MarketDetailPager.native.tsx',
    '--- a/packages/kit/src/views/Market/MarketDetailPager.native.tsx',
    '+++ b/packages/kit/src/views/Market/MarketDetailPager.native.tsx',
    '@@ -30,4 +30,15 @@',
    '+<CollapsiblePagerView />',
  ].join('\n');

  const prContext = {
    prNumber: 14_814,
    title: 'feat: integrate market detail pager and holders (OK-67420)',
    files: [
      'packages/kit/src/views/Market/Holders.tsx',
      'packages/kit/src/views/Market/MarketDetailPager.native.tsx',
      'packages/kit/src/views/Market/MarketDetailPager.tsx',
    ],
    diffText: diff,
  };

  const result = evaluateReview(
    {
      prNumber: 14_814,
      characterization: {
        type: 'cross_platform_migration',
        summary:
          'Migrate Market Detail pager and Holders list to NativeList / AppPager',
        focusAreas: [
          'cross_platform_isomorphism',
          'code_duplication',
          'half_migration',
        ],
      },
      findings: [
        {
          severity: 'P1',
          category: 'code_duplication',
          file: 'packages/kit/src/views/Market/Holders.tsx',
          line: 108,
          title: 'Extract shared NativeList patch planner instead of 4th copy',
          problem:
            'Holders.tsx duplicates planNativeListPatches + applyPatches logic for the 4th time in kit.',
          impact: 'Patch state machine bugs must be fixed in 4 places.',
          suggestedFix: 'Extract shared useNativeListPatchPlanner helper.',
          evidence: {
            executionPath:
              'Holders.tsx:108 mirrors existing NativeList patch loops',
            existingReuseTargets: [
              '.skillshare/skills/1k-code-review-pr/SKILL.md:1',
            ],
          },
        },
        {
          severity: 'P1',
          category: 'cross_platform_divergence',
          file: 'packages/kit/src/views/Market/MarketDetailPager.native.tsx',
          line: 37,
          title:
            'Unify AppPager native implementation instead of parallel pager fork',
          problem:
            'Web uses AppPager with reverse-bridged TabsContext while Native wraps CollapsiblePagerView with a private context.',
          impact:
            'Three pager/context stacks diverge across Web, Mobile, and Desktop.',
          evidence: {
            executionPath:
              'MarketDetailPager.native.tsx bypasses AppPagerContext',
          },
        },
        {
          severity: 'P2',
          category: 'edge_case',
          file: 'packages/kit/src/views/Market/Holders.tsx',
          line: 112,
          title:
            'Confirm the holders response guarantees unique account addresses',
          problem:
            'If backend returns duplicate addresses, row keys might collide.',
          evidence: {},
        },
        {
          severity: 'P2',
          category: 'a11y_or_motion',
          file: 'packages/kit/src/views/Market/Holders.tsx',
          line: 115,
          title: 'Expose the midpoint to screen readers',
          problem: 'Add accessibilityLabel for VoiceOver users.',
          evidence: { executionPath: 'VoiceOver focus traversal' },
        },
      ],
    },
    prContext,
    { repoRoot: REPO_ROOT },
  );

  assert.equal(result.observedProfile.hasCrossPlatformSignals, true);
  assert.equal(result.counts.published, 2);
  assert.equal(result.counts.dropped, 2);
  assert.equal(result.verdict, 'REQUEST_CHANGES');
  assert.ok(result.published[0].signalScore >= 85);
  assert.ok(result.published[1].signalScore >= 75);

  const payload = buildPublishPayload(result);
  assert.equal(payload.comments.length, 2);
  const md = renderMarkdownReport(result);
  assert.match(md, /PR #14814 量化门禁审查报告/);
  assert.match(md, /发布 2 条/);
  assert.match(md, /自动丢弃 2 条/);
});

test('prevents multi-round P2 review-fix spirals and enforces max 5 inline comment cap', () => {
  const prContext = {
    prNumber: 14_740,
    title: 'feat: add Lightning Self-Custody on Breez Spark',
    files: ['packages/kit-bg/src/vaults/impls/lightning/Vault.ts'],
    existingAutoThreadCount: 12,
    reviewRound: 4,
  };

  const findings = [
    {
      severity: 'P2',
      category: 'error_handling',
      file: 'packages/kit-bg/src/vaults/impls/lightning/Vault.ts',
      line: 55,
      title: 'Handle rare reconnect jitter on follow-up commit',
      problem:
        'A secondary fallback branch could retry once more on reconnect jitter.',
      evidence: {
        inDiff: true,
        executionPath: 'reconnect during retry window',
      },
    },
    ...Array.from({ length: 7 }, (_, idx) => ({
      severity: 'P1',
      category: 'security',
      file: 'packages/kit-bg/src/vaults/impls/lightning/Vault.ts',
      line: 100 + idx,
      title: `Enforce allowlist validation check #${idx + 1}`,
      problem:
        'Unvalidated recipient payload bypasses transfer allowlist before signing.',
      evidence: {
        inDiff: true,
        executionPath:
          'sendPayment() forwards raw invoice without allowlist check',
      },
    })),
  ];

  const result = evaluateReview(
    {
      prNumber: 14_740,
      characterization: {
        type: 'core_feature',
        summary: 'Add Lightning self-custody vault implementation',
        focusAreas: ['security', 'funds_safety'],
      },
      findings,
    },
    prContext,
  );

  // Follow-up round P2 must be dropped due to -35 spiral penalty
  assert.equal(result.dropped.length, 1);
  assert.ok(
    result.dropped[0].scoreBreakdown.penaltyReasons.includes(
      'follow_up_round_p2_spiral(-35)',
    ),
  );
  // 7 high-scoring P1s must be capped to 5 published + 2 summaryOnly
  assert.equal(result.counts.published, 5);
  assert.equal(result.counts.summaryOnly, 2);
});

test('allows genuine a11y findings when PR is explicitly scoped to accessibility', () => {
  const prContext = {
    prNumber: 15_001,
    title: 'feat(a11y): improve VoiceOver labels on OrderBook controls',
    files: ['packages/kit/src/views/Perp/components/OrderBook/index.tsx'],
  };

  const result = evaluateReview(
    {
      prNumber: 15_001,
      characterization: {
        type: 'core_feature',
        summary: 'Add VoiceOver accessibility labels to OrderBook controls',
        focusAreas: ['accessibility'],
      },
      findings: [
        {
          severity: 'P1',
          category: 'a11y_or_motion',
          file: 'packages/kit/src/views/Perp/components/OrderBook/index.tsx',
          line: 48,
          title:
            'Bind dynamic tick size value to tick selector accessibilityLabel',
          problem:
            'The newly added accessibilityLabel is hardcoded empty string so VoiceOver announces nothing.',
          evidence: {
            inDiff: true,
            executionPath:
              'OrderBook tick selector renders accessibilityLabel=""',
          },
        },
      ],
    },
    prContext,
  );

  assert.equal(result.observedProfile.isA11yTarget, true);
  assert.equal(result.counts.published, 1);
  assert.equal(result.published[0].scoreBreakdown.typeAlignment, 1.5);
  assert.ok(result.published[0].signalScore >= 70);
});

test('pilot rollout safeguards: JSON fence recovery, shadow passthrough, P0 safety valve, and collapsible details drawer', () => {
  // 1. JSON wrapped in markdown code fence recovers cleanly
  const fenced = parseReviewDraftSafely(
    'Here is the JSON:\n```json\n{"prNumber": 123, "findings": []}\n```\nDone.',
  );
  assert.equal(fenced.ok, true);
  assert.equal(fenced.recoveredFromFence, true);
  assert.equal(fenced.draft.prNumber, 123);

  // 2. Broken JSON fails gracefully without throwing
  const broken = parseReviewDraftSafely('not json at all');
  assert.equal(broken.ok, false);

  // 3. P0 safety valve preserves high-risk P0 in soft/shadow mode even with out-of-diff penalty
  const prContext = {
    prNumber: 15_002,
    title: 'fix: update signing payload helper',
    files: ['packages/kit-bg/src/vaults/signing.ts'],
    diffText: [
      'diff --git a/packages/kit-bg/src/vaults/signing.ts b/packages/kit-bg/src/vaults/signing.ts',
      '--- a/packages/kit-bg/src/vaults/signing.ts',
      '+++ b/packages/kit-bg/src/vaults/signing.ts',
      '@@ -10,2 +10,3 @@',
      '+const x = 1;',
    ].join('\n'),
  };

  const draft = {
    prNumber: 15_002,
    characterization: {
      type: 'targeted_bugfix',
      summary: 'Update signing payload helper',
      focusAreas: ['security'],
    },
    findings: [
      {
        severity: 'P0',
        category: 'security',
        file: 'packages/kit-bg/src/vaults/signing.ts',
        line: 99, // outside hunk -> -30 out-of-diff penalty, raw score < 55
        title: 'Confirm raw mnemonic is not logged in catch handler',
        problem: 'Mnemonic buffer might be passed into logger.',
        evidence: {},
      },
      {
        severity: 'P2',
        category: 'a11y_or_motion',
        file: 'packages/kit-bg/src/vaults/signing.ts',
        line: 10,
        title: 'Add accessibilityLabel for VoiceOver',
        problem: 'Screen reader label missing.',
        evidence: {},
      },
    ],
  };

  // In soft mode: P0 is preserved in summaryOnly via safety valve (not dropped!), and collapsible drawer renders both
  const softResult = evaluateReview(draft, prContext, { mode: 'soft' });
  assert.equal(softResult.counts.summaryOnly, 1);
  assert.equal(
    softResult.summaryOnly[0].scoreBreakdown.safetyValveApplied,
    true,
  );
  assert.equal(softResult.counts.dropped, 1);
  const md = renderMarkdownReport(softResult);
  assert.match(md, /<details>/);
  assert.match(md, /safety_valve_p0_preserved/);

  // In shadow mode: publishPayload preserves all original candidates while tagging gateDecision
  const shadowResult = evaluateReview(draft, prContext, { mode: 'shadow' });
  const shadowPayload = buildPublishPayload(shadowResult);
  assert.equal(shadowPayload.comments.length, 2);
  assert.equal(shadowPayload.mode, 'shadow');
});
