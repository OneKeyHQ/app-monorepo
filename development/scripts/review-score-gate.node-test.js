'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('path');

const {
  parseConfidence,
  parseReviewDraftSafely,
  parseUnifiedDiffHunks,
  extractObservedProfile,
  verifyCharacterization,
  evaluateReview,
  buildPublishPayload,
  renderMarkdownReport,
} = require('./review-score-gate');

const REPO_ROOT = path.resolve(__dirname, '../..');

test('parseUnifiedDiffHunks handles normal hunks, ignores added ++ lines, skips 0-count deletion hunks, and unquotes paths', () => {
  const diff = [
    'diff --git "a/packages/kit/src/my file.ts" "b/packages/kit/src/my file.ts"',
    '--- "a/packages/kit/src/my file.ts"',
    '+++ "b/packages/kit/src/my file.ts"',
    '@@ -10,2 +10,5 @@',
    '+line10',
    '+++ not a file header',
    '+line12',
    '@@ -30,3 +30,0 @@',
    '-deleted1',
    '-deleted2',
    '-deleted3',
    '@@ -40,1 +43,2 @@',
    '+line43',
  ].join('\n');

  const hunks = parseUnifiedDiffHunks(diff);
  assert.deepEqual(hunks['packages/kit/src/my file.ts'], [
    { start: 10, end: 14 },
    { start: 43, end: 44 },
  ]);
  assert.equal(Object.keys(hunks).length, 1);
});

test('parseConfidence supports emoji and plain labels and never silently upgrades missing/medium to high', () => {
  assert.equal(parseConfidence('🔵 High'), 'high');
  assert.equal(parseConfidence('high'), 'high');
  assert.equal(parseConfidence('🟠 Medium'), 'medium');
  assert.equal(parseConfidence('⚪ Low'), 'low');
  assert.equal(parseConfidence(undefined), 'low');
  assert.equal(parseConfidence('unknown'), 'low');
});

test('verifies revert PR characterization and drops a11y/motion/hinge noise (calibrated on #14812 & #337)', () => {
  const prContext = {
    prNumber: 14_812,
    title: 'revert: restore previous app toast behavior',
    files: [
      { path: 'packages/kit/src/components/Toast/toast.tsx' },
      { path: 'yarn.lock' },
    ],
  };

  const observed = extractObservedProfile(prContext);
  assert.equal(observed.isRevert, true);
  assert.equal(observed.fileCount, 2);

  const badCheck = verifyCharacterization(
    { type: 'core_feature', summary: 'Toast feature', focusAreas: ['ui'] },
    observed,
  );
  assert.equal(badCheck.valid, false);
  assert.equal(badCheck.errors[0].code, 'E_CHARACTERIZATION_MISMATCH');
  assert.equal(badCheck.effectiveType, 'revert');

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
          confidence: '🔵 High',
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
          confidence: 'high',
          category: 'edge_case',
          file: 'packages/kit/src/components/Toast/toast.tsx',
          line: 80,
          title: '修复折叠屏铰链上的 Toast 布局',
          problem: '折叠屏铰链场景下宽度可能跨屏。',
          evidence: { inDiff: true, executionPath: 'foldable hinge layout' },
        },
        {
          severity: 'P1',
          confidence: '🔵 High',
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
  assert.equal(result.verdict, 'REQUEST_CHANGES');
});

test('scores cross-platform architecture, duplication, and runtime_boundary P1s cleanly without fake refs (calibrated on #14814)', () => {
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
          confidence: '🔵 High',
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
          },
        },
        {
          severity: 'P1',
          confidence: 'high',
          category: 'runtime_boundary',
          file: 'packages/kit/src/views/Market/MarketDetailPager.native.tsx',
          line: 37,
          title:
            'Avoid pointerEvents="none" replacing native scrollEnabled lock',
          problem:
            'pointerEvents="none" does not halt ongoing iOS momentum scroll when TradingView dialog opens.',
          evidence: {
            executionPath:
              'Fling gesture continues scrolling after pointerEvents toggles',
          },
        },
        {
          severity: 'P2',
          confidence: 'high',
          category: 'edge_case',
          file: 'packages/kit/src/views/Market/Holders.tsx',
          line: 112,
          title: '确认是否后端接口保证持仓地址唯一',
          problem: '如果后端返回重复地址可能冲突。',
          evidence: {},
        },
        {
          severity: 'P2',
          confidence: 'high',
          category: 'edge_case',
          file: 'packages/kit/src/views/Market/Holders.tsx',
          line: 115,
          title: '为屏幕阅读器暴露中位数价格',
          problem: '为旁白用户补充无障碍标签。',
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
  // Both real P1s clear >= 70 without needing fake existingReuseTargets
  assert.ok(result.published[0].signalScore >= 80);
  assert.ok(result.published[1].signalScore >= 70);

  const payload = buildPublishPayload(result);
  assert.equal(payload.comments.length, 2);
  const md = renderMarkdownReport(result);
  assert.match(md, /### 量化门禁评分附录（PR #14814）/);
  assert.match(md, /发布 2 条/);
  assert.match(md, /自动过滤 2 条/);
});

test('prevents multi-round P2 spirals, publishes all qualifying P1s, and routes existing unresolved threads to REPLY_THREAD without dropping verdict', () => {
  const prContext = {
    prNumber: 14_740,
    title: 'feat: add Lightning Self-Custody on Breez Spark',
    files: ['packages/kit-bg/src/vaults/impls/lightning/Vault.ts'],
    existingAutoThreadCount: 12,
    reviewRound: 4,
    existingThreads: [
      {
        id: 'PRRT_existing_1',
        isResolved: false,
        path: 'packages/kit-bg/src/vaults/impls/lightning/Vault.ts',
        title: 'Enforce allowlist validation check #1',
      },
    ],
  };

  const findings = [
    {
      severity: 'P2',
      confidence: 'high',
      category: 'error_handling',
      file: 'packages/kit-bg/src/vaults/impls/lightning/Vault.ts',
      line: 55,
      title: 'Handle rare reconnect jitter on follow-up commit',
      problem: 'Secondary fallback branch could retry once more.',
      evidence: {
        inDiff: true,
        executionPath: 'reconnect during retry window',
      },
    },
    ...Array.from({ length: 7 }, (_, idx) => ({
      severity: 'P1',
      confidence: 'high',
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

  // Follow-up round P2 dropped; all 7 real P1s published; #1 routed to REPLY_THREAD instead of dropped
  assert.equal(result.dropped.length, 1);
  assert.equal(result.counts.published, 7);
  const matched = result.published.find(
    (f) => f.title === 'Enforce allowlist validation check #1',
  );
  assert.equal(matched.publishAction, 'REPLY_THREAD');
  assert.equal(matched.duplicateOfThreadId, 'PRRT_existing_1');
  assert.equal(result.verdict, 'REQUEST_CHANGES');
});

test('allows genuine a11y findings when PR is explicitly scoped to accessibility', () => {
  const prContext = {
    prNumber: 15_001,
    title: 'feat(a11y): improve VoiceOver labels on OrderBook controls',
    labels: [{ name: 'a11y' }],
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
          confidence: 'high',
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

test('pilot safeguards: multi-fence JSON recovery, null rejection, non-speculative P0 safety valve, and shadow unanchored separation', () => {
  // 1. Picks ```json fence even when an earlier non-json fence appears first
  const multiFence = parseReviewDraftSafely(
    '```bash\necho hi\n```\n```json\n{"prNumber": 123, "findings": []}\n```',
  );
  assert.equal(multiFence.ok, true);
  assert.equal(multiFence.draft.prNumber, 123);

  // 2. Rejects JSON primitive/null safely
  assert.equal(parseReviewDraftSafely('null').ok, false);
  assert.equal(parseReviewDraftSafely('[]').ok, false);

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
        confidence: 'low',
        category: 'security',
        file: 'packages/kit-bg/src/vaults/signing.ts',
        line: 99,
        title: 'Confirm raw mnemonic is not logged in catch handler',
        problem: 'Speculative question with no proof.',
        evidence: {},
      },
      {
        severity: 'P0',
        confidence: 'medium',
        category: 'security',
        file: 'packages/kit-bg/src/vaults/signing.ts',
        line: 99, // out of diff, non-speculative -> preserved by safety valve in soft mode
        isPreExisting: false,
        title: 'Raw private key serialized into error telemetry payload',
        problem: 'Error reporter serializes full signer context on failure.',
        evidence: {
          executionPath: 'signTx() catch block forwards signer state to logger',
        },
      },
    ],
  };

  // Speculative P0 must be DROPPED (never rescued by safety valve); real non-speculative P0 is preserved
  const softResult = evaluateReview(draft, prContext, { mode: 'soft' });
  assert.equal(softResult.counts.dropped, 1);
  assert.equal(softResult.counts.summaryOnly, 1);
  assert.equal(
    softResult.summaryOnly[0].title,
    'Raw private key serialized into error telemetry payload',
  );
  const md = renderMarkdownReport(softResult);
  assert.match(md, /<details>/);

  // Shadow mode separates unanchored comments so GitHub API will not 422
  const shadowResult = evaluateReview(draft, prContext, { mode: 'shadow' });
  const shadowPayload = buildPublishPayload(shadowResult);
  assert.equal(shadowPayload.comments.length, 2);
});

test('mixed deps+app PR is not locked to deps_or_ci, missing anchor stays in summary, and context identity wins', () => {
  const prContext = {
    prNumber: 15_003,
    headRefOid: 'new_sha_999',
    title: 'feat: upgrade native-list and add holders cache',
    files: [
      'package.json',
      'yarn.lock',
      'apps/mobile/ios/Podfile.lock',
      '.github/workflows/lint.yml',
      'packages/kit/src/views/Market/Holders.tsx',
    ],
  };

  const observed = extractObservedProfile(prContext);
  assert.equal(observed.isDepsOrCi, false);

  const result = evaluateReview(
    {
      prNumber: 15_003,
      headSha: 'stale_sha_111',
      characterization: {
        type: 'core_feature',
        summary: 'Add holders cache alongside dependency bump',
        focusAreas: ['correctness'],
      },
      findings: [
        {
          severity: 'P1',
          confidence: 'high',
          category: 'data_corruption',
          file: 'packages/kit/src/views/Market/Holders.tsx',
          line: null,
          title: 'Reset stale holder cache on network switch',
          problem: 'Cache key omits networkId.',
          evidence: {
            inDiff: true,
            executionPath: 'switchNetwork() reuses previous chain holders',
          },
        },
        {
          severity: 'P1',
          confidence: '🟠 Medium',
          category: 'security',
          file: 'packages/kit/src/views/Market/Holders.tsx',
          line: 20,
          title: 'Medium-confidence P1 stays out of inline publish',
          problem: 'Needs verification against upstream guard.',
          evidence: {
            inDiff: true,
            executionPath: 'concrete path for medium confidence P1',
          },
        },
      ],
    },
    prContext,
  );

  assert.equal(result.headSha, 'new_sha_999');
  assert.ok(result.gateErrors.some((e) => e.code === 'E_CONTEXT_MISMATCH'));
  assert.equal(result.counts.published, 0);
  assert.equal(result.counts.summaryOnly, 2);
  assert.equal(result.verdict, 'COMMENT');
  assert.match(renderMarkdownReport(result), /E_CONTEXT_MISMATCH/);
});
