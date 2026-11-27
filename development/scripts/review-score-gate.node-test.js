'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
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
    '--- old sql comment',
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

  // Shadow mode separates out-of-diff unanchored comments so GitHub API will not 422
  const shadowResult = evaluateReview(draft, prContext, { mode: 'shadow' });
  const shadowPayload = buildPublishPayload(shadowResult);
  assert.equal(shadowPayload.comments.length, 0);
  assert.equal(shadowPayload.unanchoredComments.length, 2);
  assert.equal(shadowPayload.mode, 'shadow');
});

test('handles gh pr view number field, auto-corrects mismatched feature characterization, preserves proven Verify P0s, and ignores empty thread titles', () => {
  const prContext = {
    number: 15_004,
    headRefOid: 'sha_current',
    title: 'feat: add EIP-712 typed data signing',
    files: ['packages/kit-bg/src/vaults/signing.ts'],
    existingThreads: [
      {
        id: 'PRRT_empty_title',
        isResolved: false,
        path: 'packages/kit-bg/src/vaults/signing.ts',
        title: '',
      },
    ],
  };

  const result = evaluateReview(
    {
      prNumber: 99_999, // conflicts with prContext.number
      headSha: 'sha_current',
      characterization: {
        type: 'revert', // mismatched on a feat: PR -> must auto-correct to core_feature
        summary: 'Add EIP-712 signing',
        focusAreas: ['security'],
      },
      findings: [
        {
          severity: 'P0',
          confidence: '🔵 High',
          category: 'security',
          file: 'packages/kit-bg/src/vaults/signing.ts',
          line: 42,
          title: 'Verify EIP-712 domain chainId before signing typed data',
          problem: 'Missing chainId check allows cross-chain signature replay.',
          evidence: {
            inDiff: true,
            executionPath:
              'signTypedData() signs payload without comparing domain.chainId',
          },
        },
      ],
    },
    prContext,
  );

  // 1. prContext.number wins, mismatch is recorded, and inline publish is demoted to summaryOnly (never post stale/wrong-PR inline comments)
  assert.equal(result.prNumber, 15_004);
  assert.ok(result.gateErrors.some((e) => e.code === 'E_CONTEXT_MISMATCH'));
  // 2. Characterization auto-corrects from 'revert' to 'core_feature'
  assert.equal(result.characterizationCheck.effectiveType, 'core_feature');
  // 3. Proven imperative 'Verify ...' P0 is NOT dropped as speculative, NOT hijacked by empty existing thread, and still blocks verdict
  assert.equal(result.counts.published, 0);
  assert.equal(result.counts.summaryOnly, 1);
  assert.equal(result.summaryOnly[0].publishAction, 'NEW_THREAD');
  assert.equal(result.summaryOnly[0].duplicateOfThreadId, null);
  assert.equal(result.verdict, 'REQUEST_CHANGES');
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

test('scores deleted-file and pure-deletion-hunk findings without pre_existing penalty, and fails open on null entries in soft mode', () => {
  const diff = [
    'diff --git a/packages/kit/src/boot/init.ts b/packages/kit/src/boot/init.ts',
    '--- a/packages/kit/src/boot/init.ts',
    '+++ /dev/null',
    '@@ -1,10 +0,0 @@',
    '--- removed comment',
    '-export const initBridge = () => {};',
  ].join('\n');

  const result = evaluateReview(
    {
      prNumber: 15_005,
      characterization: {
        type: 'revert',
        summary: 'Revert bridge boot module',
        focusAreas: ['startup'],
      },
      findings: [
        null, // malformed entry must not crash soft mode
        {
          severity: 'P0',
          confidence: 'high',
          category: 'runtime_boundary',
          file: 'packages/kit/src/boot/init.ts',
          line: 2,
          title: 'Startup still imports deleted bridge init module',
          problem: 'App entry point crashes on boot after init.ts deletion.',
          evidence: {
            inDiff: true,
            executionPath: 'App startup invokes missing bridge module',
          },
        },
      ],
    },
    {
      number: 15_005,
      title: 'revert: remove bridge init',
      files: ['packages/kit/src/boot/init.ts'],
      diffText: diff,
      existingThreads: [null], // malformed thread must not crash
    },
    { mode: 'soft' },
  );

  // Malformed entry recorded as gateError instead of throwing TypeError
  assert.ok(
    result.gateErrors.some((e) => e.code === 'E_INVALID_FINDING_ENTRY'),
  );
  // Deleted-file P0 receives in_deletion_diff(+15), stays in summaryOnly (cannot attach RIGHT anchor), and drives REQUEST_CHANGES
  assert.equal(result.counts.published, 0);
  assert.equal(result.counts.summaryOnly, 1);
  assert.ok(result.summaryOnly[0].signalScore >= 60);
  assert.equal(result.verdict, 'REQUEST_CHANGES');

  // Passing null as prContext in soft mode does not crash
  const nullCtxResult = evaluateReview(
    {
      characterization: { type: 'general', summary: 'ok', focusAreas: ['x'] },
      findings: [],
    },
    null,
    { mode: 'soft' },
  );
  assert.equal(nullCtxResult.counts.published, 0);
});

test('low-score safety-valve P0 drives REQUEST_CHANGES and P0 cross_platform_divergence mentioning keyboard focus is not reclassified', () => {
  const prContext = {
    prNumber: 15_010,
    title: 'revert: restore previous hardware signing modal',
    files: ['packages/kit/src/views/Hardware/ConfirmModal.native.tsx'],
  };

  const result = evaluateReview(
    {
      prNumber: 15_010,
      characterization: {
        type: 'revert',
        summary: 'Revert hardware signing modal to previous implementation',
        focusAreas: ['cross_platform_consistency'],
      },
      findings: [
        {
          severity: 'P0',
          confidence: 'medium',
          category: 'cross_platform_divergence',
          file: 'packages/kit/src/views/Hardware/ConfirmModal.native.tsx',
          line: 42,
          isPreExisting: false,
          title:
            'Desktop confirm handler diverges on keyboard focus submit path',
          problem:
            'Reverting only native leaves desktop keyboard focus handler submitting an unverified signing payload.',
          evidence: {},
        },
      ],
    },
    prContext,
    { mode: 'soft' },
  );

  assert.equal(result.counts.published, 0);
  assert.equal(result.counts.summaryOnly, 1);
  const rescued = result.summaryOnly[0];
  assert.equal(rescued.effectiveCategory, 'cross_platform_divergence');
  assert.deepEqual(rescued.scoreBreakdown.reclassifiedReasons, []);
  assert.ok(rescued.signalScore < 50);
  assert.equal(rescued.scoreBreakdown.safetyValveApplied, true);
  assert.equal(result.verdict, 'REQUEST_CHANGES');
});

test('parseReviewDraftSafely extracts fenced JSON with embedded triple backticks and prose braces', () => {
  const embeddedFix = 'Wrap handler:\n```ts\nconst ok = true;\n```';
  const payload = {
    prNumber: 15_011,
    characterization: {
      type: 'targeted_bugfix',
      summary: 'Fix handler',
      focusAreas: ['correctness'],
    },
    findings: [
      {
        severity: 'P1',
        confidence: 'high',
        category: 'crash',
        file: 'packages/kit/src/index.ts',
        line: 10,
        title: 'Guard null state',
        problem: 'Null dereference on empty state.',
        suggestedFix: embeddedFix,
      },
    ],
  };
  const raw = [
    'Review notes {not json here} before fence:',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
    'Trailing note {also not json}.',
  ].join('\n');

  const parsed = parseReviewDraftSafely(raw);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.recoveredFromFence, true);
  assert.equal(parsed.draft.prNumber, 15_011);
  assert.equal(parsed.draft.findings[0].suggestedFix, embeddedFix);
});

test('renderMarkdownReport in shadow mode distinguishes actual passthrough from simulated gate counts', () => {
  const diff = [
    'diff --git a/packages/kit/src/views/Toast.tsx b/packages/kit/src/views/Toast.tsx',
    '--- a/packages/kit/src/views/Toast.tsx',
    '+++ b/packages/kit/src/views/Toast.tsx',
    '@@ -10,2 +10,5 @@',
    '+const visible = true;',
  ].join('\n');

  const result = evaluateReview(
    {
      prNumber: 15_012,
      characterization: {
        type: 'targeted_bugfix',
        summary: 'Adjust toast visibility flag',
        focusAreas: ['correctness'],
      },
      findings: [
        {
          severity: 'P2',
          confidence: 'high',
          category: 'style_nit',
          file: 'packages/kit/src/views/Toast.tsx',
          line: 12,
          title: 'Prefer descriptive boolean name',
          problem: 'Minor naming nit inside changed hunk.',
          evidence: { inDiff: true },
        },
      ],
    },
    {
      prNumber: 15_012,
      title: 'fix: adjust toast visibility',
      files: ['packages/kit/src/views/Toast.tsx'],
      diffText: diff,
    },
    { mode: 'shadow' },
  );

  const payload = buildPublishPayload(result);
  assert.equal(payload.comments.length, 1);
  assert.equal(result.counts.published, 0);
  assert.equal(result.counts.dropped, 1);

  const md = renderMarkdownReport(result);
  assert.match(md, /实际透传 1 条行内评论/);
  assert.match(md, /建议发布 0 条 \/ 仅报告 0 条 \/ 模拟过滤 1 条/);
  assert.doesNotMatch(md, /本次发布 0 条行内评论/);
});

test('CLI handles strict fenced rejection, soft fallback full draft preservation, and invalid context JSON recording', () => {
  const scriptPath = path.join(__dirname, 'review-score-gate.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-score-gate-'));

  try {
    const validDraft = {
      prNumber: 15_013,
      characterization: {
        type: 'targeted_bugfix',
        summary: 'Fix cache invalidation',
        focusAreas: ['correctness'],
      },
      findings: [],
    };
    const validContext = {
      prNumber: 15_013,
      title: 'fix: invalidate stale cache',
      files: ['packages/kit/src/cache.ts'],
    };

    // 1. --mode strict rejects fenced JSON with exit 2 and writes no output files
    const fencedDraftPath = path.join(tmpDir, 'fenced-draft.json');
    const contextPath = path.join(tmpDir, 'context.json');
    const strictOutJson = path.join(tmpDir, 'strict-out.json');
    const strictOutMd = path.join(tmpDir, 'strict-out.md');
    fs.writeFileSync(
      fencedDraftPath,
      `\`\`\`json\n${JSON.stringify(validDraft)}\n\`\`\`\n`,
    );
    fs.writeFileSync(contextPath, JSON.stringify(validContext));

    const strictRun = spawnSync(
      process.execPath,
      [
        scriptPath,
        'evaluate',
        '--input',
        fencedDraftPath,
        '--context',
        contextPath,
        '--mode',
        'strict',
        '--out-json',
        strictOutJson,
        '--out-md',
        strictOutMd,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(strictRun.status, 2);
    assert.match(strictRun.stderr, /raw valid JSON/i);
    assert.equal(fs.existsSync(strictOutJson), false);
    assert.equal(fs.existsSync(strictOutMd), false);

    // 2. --mode soft with unparseable JSON exits 0 and preserves full rawDraft (> 500 chars)
    const tailMarker = 'END_OF_LONG_UNPARSEABLE_DRAFT_MARKER';
    const longBrokenDraft = `${'Review prose without JSON. '.repeat(30)}${tailMarker}`;
    assert.ok(longBrokenDraft.length > 500);
    const brokenDraftPath = path.join(tmpDir, 'broken-draft.txt');
    const fallbackOutJson = path.join(tmpDir, 'fallback-out.json');
    const fallbackOutMd = path.join(tmpDir, 'fallback-out.md');
    fs.writeFileSync(brokenDraftPath, longBrokenDraft);

    const fallbackRun = spawnSync(
      process.execPath,
      [
        scriptPath,
        'evaluate',
        '--input',
        brokenDraftPath,
        '--mode',
        'soft',
        '--out-json',
        fallbackOutJson,
        '--out-md',
        fallbackOutMd,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(fallbackRun.status, 0);
    const fallbackJson = JSON.parse(fs.readFileSync(fallbackOutJson, 'utf8'));
    assert.equal(fallbackJson.status, 'fallback_passthrough');
    assert.equal(fallbackJson.rawDraft, longBrokenDraft);
    assert.equal(fallbackJson.rawDraftPreview, longBrokenDraft.slice(0, 500));
    const fallbackMd = fs.readFileSync(fallbackOutMd, 'utf8');
    assert.ok(fallbackMd.includes(tailMarker));

    // 3. --mode soft with invalid --context JSON exits 0 and records E_INVALID_CONTEXT_JSON
    const rawDraftPath = path.join(tmpDir, 'valid-draft.json');
    const badContextPath = path.join(tmpDir, 'bad-context.json');
    const badCtxOutJson = path.join(tmpDir, 'bad-ctx-out.json');
    fs.writeFileSync(rawDraftPath, JSON.stringify(validDraft));
    fs.writeFileSync(badContextPath, '{invalid json');

    const badCtxRun = spawnSync(
      process.execPath,
      [
        scriptPath,
        'evaluate',
        '--input',
        rawDraftPath,
        '--context',
        badContextPath,
        '--mode',
        'soft',
        '--out-json',
        badCtxOutJson,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(badCtxRun.status, 0);
    const badCtxJson = JSON.parse(fs.readFileSync(badCtxOutJson, 'utf8'));
    assert.equal(badCtxJson.status, 'validation_errors');
    assert.equal(badCtxJson.verdict, 'COMMENT');
    assert.ok(
      badCtxJson.gateErrors.some((e) => e.code === 'E_INVALID_CONTEXT_JSON'),
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('addresses unresolved PR review threads: exact confidence, proven Check-that P0, alternate-anchor autoFix, title cross-platform signal, deletion hunks, git-quoted paths, and prototype-safe keys', () => {
  // 1. Exact confidence matching avoids substring false-positives
  assert.equal(parseConfidence('🟠 Medium (high impact)'), 'low');
  assert.equal(parseConfidence('  🔵   High '), 'high');
  assert.equal(parseConfidence('🟠 Medium'), 'medium');

  // 2. Context-bearing deletion hunk, prototype-keyed deleted file ('toString'), and Git-quoted UTF-8 path
  const diff = [
    'diff --git a/toString b/toString',
    '--- a/toString',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    '-deleted line 1',
    '-deleted line 2',
    'diff --git "a/packages/kit/src/\\344\\270\\255\\346\\226\\207.ts" "b/packages/kit/src/\\344\\270\\255\\346\\226\\207.ts"',
    '--- "a/packages/kit/src/\\344\\270\\255\\346\\226\\207.ts"',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    '-export const removed = true;',
    'diff --git a/packages/kit/src/shared/auth.ts b/packages/kit/src/shared/auth.ts',
    '--- a/packages/kit/src/shared/auth.ts',
    '+++ b/packages/kit/src/shared/auth.ts',
    '@@ -10,4 +10,3 @@',
    ' const a = 1;',
    '-verifyOrigin(req);',
    ' const b = 2;',
    ' const c = 3;',
  ].join('\n');

  const prContext = {
    number: 15_020,
    headRefOid: 'sha_15020',
    title: 'feat: cross-platform migration for shared auth guard',
    files: [
      'toString',
      'packages/kit/src/中文.ts',
      'packages/kit/src/shared/auth.ts',
    ],
    diffText: diff,
  };

  const observed = extractObservedProfile(prContext);
  assert.equal(observed.hasCrossPlatformSignals, true);

  const result = evaluateReview(
    {
      prNumber: 15_020,
      headSha: 'sha_15020',
      characterization: {
        type: 'cross_platform_migration',
        summary: 'Migrate shared auth guard across platforms',
        focusAreas: ['security', 'half_migration'],
      },
      findings: [
        {
          // Proven P0 titled "Check that ..." must NOT be marked speculative
          severity: 'P0',
          confidence: '🔵 High',
          category: 'security',
          file: 'packages/kit/src/shared/auth.ts',
          line: 11,
          side: 'LEFT',
          anchorFile: 'packages/kit/src/shared/auth.ts',
          anchorLine: 10, // alternate anchor -> autoFix must NOT render as ```suggestion
          title:
            'Check that origin verification is not removed during auth migration',
          problem:
            'Removing verifyOrigin(req) allows untrusted origins to call sign().',
          autoFix: 'verifyOrigin(req);',
          evidence: {
            reproduction:
              'Call sign() from untrusted origin after line 11 deletion',
          },
        },
        {
          // Deleted UTF-8 Git-quoted file should gain deletion evidence
          severity: 'P0',
          confidence: 'high',
          category: 'crash',
          file: 'packages/kit/src/中文.ts',
          line: 1,
          title: 'Deleted Chinese module still imported at startup',
          problem: 'App throws module-not-found for removed file.',
          evidence: {
            executionPath: 'App entry imports packages/kit/src/中文.ts',
          },
        },
        {
          // Surviving file right-side finding at line 11 (outside right hunk if line 99, or same line 11 without side:LEFT)
          // Line 11 is in rightHunks (10..12), so test line 50 in surviving file with no rightHunk and no side:LEFT
          severity: 'P1',
          confidence: 'high',
          category: 'error_handling',
          file: 'packages/kit/src/shared/auth.ts',
          line: 11,
          anchorFile: 'packages/kit/src/shared/auth.ts',
          anchorLine: 50,
          title:
            'Right-side finding without LEFT side does not get deletion credit on line 11',
          problem: 'Unchanged line 50 should not match deleted base line 11.',
          evidence: {
            executionPath: 'Line 50 runs independently',
          },
        },
      ],
    },
    prContext,
    { mode: 'soft' },
  );

  // Proven "Check that ..." P0 is published and uses non-suggestion code block because anchorLine !== line
  assert.equal(result.counts.published, 1);
  assert.equal(result.published[0].scoreBreakdown.isSpeculative, false);
  const payload = buildPublishPayload(result);
  assert.equal(payload.comments.length, 1);
  assert.doesNotMatch(payload.comments[0].body, /```suggestion/);
  assert.match(payload.comments[0].body, /verifyOrigin\(req\);/);

  // Deleted Git-quoted UTF-8 file gained in_deletion_diff(+15)
  const deletedUtf8Finding = result.summaryOnly.find(
    (f) => f.file === 'packages/kit/src/中文.ts',
  );
  assert.ok(deletedUtf8Finding);
  assert.ok(
    deletedUtf8Finding.scoreBreakdown.evidenceNotes.includes(
      'in_deletion_diff(+15)',
    ),
  );

  // Right-side finding without side:'LEFT' did NOT get deletion evidence
  const rightSideFinding = result.allScored.find((f) => f.anchorLine === 50);
  assert.ok(rightSideFinding);
  assert.equal(
    rightSideFinding.scoreBreakdown.evidenceNotes.includes(
      'in_deletion_diff(+15)',
    ),
    false,
  );

  // Backslash + pipe escaping in Markdown table cells (CodeQL incomplete escaping)
  const md = renderMarkdownReport(
    evaluateReview(
      {
        prNumber: 15_021,
        characterization: {
          type: 'core_feature',
          summary: 'Escape test',
          focusAreas: ['security'],
        },
        findings: [
          {
            severity: 'P0',
            confidence: 'high',
            category: 'security',
            file: 'packages/kit/src/shared/auth.ts',
            line: 10,
            title: 'Handle raw \\| pipe escape safely',
            problem: 'Contains backslash and pipe.',
            evidence: { inDiff: true, executionPath: 'concrete path' },
          },
        ],
      },
      {
        number: 15_021,
        title: 'feat: escape test',
        files: ['packages/kit/src/shared/auth.ts'],
      },
    ),
  );
  assert.ok(md.includes('Handle raw \\\\\\| pipe escape safely'));
});

test('hardens stale-SHA publish guard, LEFT-without-anchor safety, pre-existing P0 isolation, line-based fence recovery, docs cross-platform PRs, file-level/emptied-file diff evidence, and strict empty context', () => {
  // 1. Fence scanner handles preceding ```bash block with {braces} AND indented list ```json fence
  const bashBeforeJson = [
    'Before:',
    '```bash',
    'echo {status}',
    '```',
    '- Result:',
    '  ```json',
    '  {"prNumber": 15030, "findings": []}',
    '  ```',
  ].join('\n');
  const parsedFence = parseReviewDraftSafely(bashBeforeJson);
  assert.equal(parsedFence.ok, true);
  assert.equal(parsedFence.recoveredFromFence, true);
  assert.equal(parsedFence.draft.prNumber, 15_030);

  // 2. Docs-only PR mentioning cross-platform keeps 'general' valid
  const docsObserved = extractObservedProfile({
    number: 15_031,
    headRefOid: 'sha_docs',
    title: 'docs: update cross-platform setup guide',
    files: ['docs/cross-platform-guide.md'],
  });
  assert.equal(docsObserved.hasCrossPlatformSignals, false);
  assert.ok(docsObserved.expectedTypes.includes('general'));

  // 3. Combined diff: surviving file + emptied file (pure deletion hunk without /dev/null)
  const diff = [
    'diff --git a/packages/kit/src/shared/auth.ts b/packages/kit/src/shared/auth.ts',
    '--- a/packages/kit/src/shared/auth.ts',
    '+++ b/packages/kit/src/shared/auth.ts',
    '@@ -10,4 +10,3 @@',
    ' const a = 1;',
    '-verifyOrigin(req);',
    ' const b = 2;',
    ' const c = 3;',
    'diff --git a/packages/kit/src/shared/emptied.ts b/packages/kit/src/shared/emptied.ts',
    '--- a/packages/kit/src/shared/emptied.ts',
    '+++ b/packages/kit/src/shared/emptied.ts',
    '@@ -1,3 +0,0 @@',
    '-export const mustExist = 1;',
    '-export const mustExist2 = 2;',
    '-export const mustExist3 = 3;',
  ].join('\n');

  // 3a. LEFT finding without explicit anchorLine cannot attach to RIGHT hunk; pre-existing P0 cannot block;
  //     file-level (line: null) & emptied-file findings get diff credit without pre_existing penalty
  const evalResult = evaluateReview(
    {
      prNumber: 15_032,
      headSha: 'sha_15032',
      characterization: {
        type: 'targeted_bugfix',
        summary: 'Update auth and clean emptied helper',
        focusAreas: ['security', 'crash'],
      },
      findings: [
        {
          severity: 'P0',
          confidence: 'high',
          category: 'security',
          file: 'packages/kit/src/shared/auth.ts',
          line: 11,
          side: 'LEFT',
          // no anchorLine -> must NOT attach to surviving RIGHT line 11
          title: 'Restoring removed verifyOrigin check',
          problem: 'Origin check was removed at base line 11.',
          autoFix: 'verifyOrigin(req);',
          evidence: { executionPath: 'sign() bypasses origin guard' },
        },
        {
          severity: 'P1',
          confidence: 'high',
          category: 'data_corruption',
          file: 'packages/kit/src/shared/auth.ts',
          line: null,
          title: 'File-level auth state corruption',
          problem: 'Module-wide cache is not cleared on logout.',
          evidence: { executionPath: 'logout() leaves module cache populated' },
        },
        {
          severity: 'P1',
          confidence: 'high',
          category: 'crash',
          file: 'packages/kit/src/shared/emptied.ts',
          line: 1,
          // omits side:'LEFT' on emptied file with 0 right hunks
          title: 'Emptied module still imported by boot loader',
          problem: 'Boot loader crashes reading undefined export.',
          evidence: { executionPath: 'boot() reads mustExist from emptied.ts' },
        },
      ],
    },
    {
      number: 15_032,
      headRefOid: 'sha_15032',
      title: 'fix: update auth guard',
      files: [
        'packages/kit/src/shared/auth.ts',
        'packages/kit/src/shared/emptied.ts',
      ],
      diffText: diff,
    },
    { mode: 'soft' },
  );

  // LEFT finding without explicit anchorLine stays in summaryOnly (hasValidInlineAnchor = false)
  assert.equal(evalResult.counts.published, 0);
  assert.equal(evalResult.counts.summaryOnly, 3);
  const leftFinding = evalResult.summaryOnly.find(
    (f) => f.title === 'Restoring removed verifyOrigin check',
  );
  assert.equal(leftFinding.scoreBreakdown.hasValidInlineAnchor, false);
  const fileLevelFinding = evalResult.summaryOnly.find((f) => f.line === null);
  assert.ok(
    fileLevelFinding.scoreBreakdown.evidenceNotes.includes('in_diff_file(+15)'),
  );
  const emptiedFinding = evalResult.summaryOnly.find(
    (f) => f.file === 'packages/kit/src/shared/emptied.ts',
  );
  assert.ok(
    emptiedFinding.scoreBreakdown.evidenceNotes.includes(
      'in_deletion_diff(+15)',
    ),
  );

  // 3b. Explicitly pre-existing P0 must NOT trigger safety valve or REQUEST_CHANGES
  const preExistingResult = evaluateReview(
    {
      prNumber: 15_033,
      headSha: 'sha_15033',
      characterization: {
        type: 'revert',
        summary: 'Revert unrelated toast',
        focusAreas: ['revert'],
      },
      findings: [
        {
          severity: 'P0',
          confidence: 'low',
          category: 'security',
          file: 'packages/kit/src/shared/auth.ts',
          line: 99,
          isPreExisting: true,
          title: 'Pre-existing legacy auth issue',
          problem: 'Untouched legacy function lacks check.',
          evidence: {},
        },
      ],
    },
    {
      number: 15_033,
      headRefOid: 'sha_15033',
      title: 'revert: toast change',
      files: ['packages/kit/src/shared/auth.ts'],
      diffText: diff,
    },
    { mode: 'soft' },
  );
  assert.equal(preExistingResult.counts.dropped, 1);
  assert.equal(
    preExistingResult.dropped[0].scoreBreakdown.safetyValveApplied,
    false,
  );
  assert.equal(preExistingResult.verdict, 'APPROVE');

  // 3c. Stale headSha draft must NOT emit inline publishPayload.comments
  const staleResult = evaluateReview(
    {
      prNumber: 15_034,
      headSha: 'old_sha_111',
      characterization: {
        type: 'targeted_bugfix',
        summary: 'Fix auth',
        focusAreas: ['security'],
      },
      findings: [
        {
          severity: 'P0',
          confidence: 'high',
          category: 'security',
          file: 'packages/kit/src/shared/auth.ts',
          line: 10,
          title: 'Stale finding on old commit',
          problem: 'Would attach to wrong commit if published.',
          evidence: { inDiff: true, executionPath: 'concrete path' },
        },
      ],
    },
    {
      number: 15_034,
      headRefOid: 'new_sha_222',
      title: 'fix: auth',
      files: ['packages/kit/src/shared/auth.ts'],
      diffText: diff,
    },
    { mode: 'soft' },
  );
  assert.equal(staleResult.counts.published, 0);
  assert.equal(buildPublishPayload(staleResult).comments.length, 0);

  // 4. CLI --mode strict rejects empty {} --context with exit 2
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-gate-strict-'));
  try {
    const scriptPath = path.join(__dirname, 'review-score-gate.js');
    const draftPath = path.join(tmpDir, 'draft.json');
    const emptyCtxPath = path.join(tmpDir, 'empty-ctx.json');
    fs.writeFileSync(
      draftPath,
      JSON.stringify({
        prNumber: 15_035,
        headSha: 'sha_15035',
        characterization: { type: 'general', summary: 'ok', focusAreas: ['x'] },
        findings: [],
      }),
    );
    fs.writeFileSync(emptyCtxPath, '{}');
    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        'evaluate',
        '--input',
        draftPath,
        '--context',
        emptyCtxPath,
        '--mode',
        'strict',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(run.status, 2);
    assert.match(run.stderr, /non-empty PR identity/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
