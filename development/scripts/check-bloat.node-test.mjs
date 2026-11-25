import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ZERO_BASELINE_RATIO_LABEL,
  evaluateAmplification,
  evaluateEquilibrium,
  findPreReviewCommitFromLog,
  formatAmplificationRatio,
  formatCliAmplificationLine,
  formatCliEquilibriumLine,
  isSubstantiveReview,
  isTargetCodeFile,
  reconcileBaseAdvancedStats,
  selectEarliestReviewAnchor,
} from './check-bloat.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

test('zero baseline with large growth returns null ratio and triggers gate (PR #14744 shape)', () => {
  const amp = evaluateAmplification({
    origNet: -15,
    fixAdded: 487,
    fixDeleted: 79,
    fixNet: 408,
  });

  assert.equal(amp.origNet, 0);
  assert.equal(amp.amplificationRatio, null);
  assert.equal(amp.deletionRatio, 0.162);
  assert.equal(amp.triggered, true);
  assert.equal(
    formatAmplificationRatio(amp.amplificationRatio),
    ZERO_BASELINE_RATIO_LABEL,
  );
  assert.match(
    formatCliAmplificationLine(amp),
    /ratio=N\/A \(baseline net growth is zero\) \| del\/add=16% \[FAIL\]$/,
  );
  assert.doesNotMatch(formatCliAmplificationLine(amp), /99900%/);
});

test('zero baseline with no growth or net shrink returns null ratio and does not trigger', () => {
  for (const caseInput of [
    { origNet: 0, fixAdded: 0, fixDeleted: 0, fixNet: 0 },
    { origNet: 0, fixAdded: 20, fixDeleted: 20, fixNet: 0 },
    { origNet: -10, fixAdded: 5, fixDeleted: 30, fixNet: -25 },
  ]) {
    const amp = evaluateAmplification(caseInput);
    assert.equal(amp.origNet, 0);
    assert.equal(amp.amplificationRatio, null);
    assert.equal(amp.triggered, false);
    assert.equal(
      formatAmplificationRatio(amp.amplificationRatio),
      ZERO_BASELINE_RATIO_LABEL,
    );
  }
});

test('positive baseline preserves percentage ratio and 50% threshold behavior', () => {
  const belowRatio = evaluateAmplification({
    origNet: 300,
    fixAdded: 140,
    fixDeleted: 0,
    fixNet: 140,
  });
  assert.equal(belowRatio.amplificationRatio, 0.467);
  assert.equal(belowRatio.triggered, false);
  assert.equal(formatAmplificationRatio(belowRatio.amplificationRatio), '47%');

  const atRatio = evaluateAmplification({
    origNet: 240,
    fixAdded: 120,
    fixDeleted: 0,
    fixNet: 120,
  });
  assert.equal(atRatio.amplificationRatio, 0.5);
  assert.equal(atRatio.triggered, true);
  assert.match(
    formatCliAmplificationLine(atRatio),
    /vs orig \+240 \| ratio=50% \| del\/add=0% \[FAIL\]$/,
  );

  const zeroFix = evaluateAmplification({
    origNet: 200,
    fixAdded: 10,
    fixDeleted: 10,
    fixNet: 0,
  });
  assert.equal(zeroFix.amplificationRatio, 0);
  assert.equal(formatAmplificationRatio(zeroFix.amplificationRatio), '0%');
});

test('large PR hard cap (maxAbsoluteFixNetLines = 300) triggers even when ratio < 50%', () => {
  const largePrBloat = evaluateAmplification({
    origNet: 2000,
    fixAdded: 320,
    fixDeleted: 20,
    fixNet: 300,
  });
  assert.equal(largePrBloat.amplificationRatio, 0.15);
  assert.equal(largePrBloat.hardCapReached, true);
  assert.equal(largePrBloat.triggered, true);

  const largePrRefactor = evaluateAmplification({
    origNet: 2000,
    fixAdded: 450,
    fixDeleted: 150,
    fixNet: 300,
  });
  assert.equal(largePrRefactor.deletionRatio, 0.333);
  assert.equal(largePrRefactor.triggered, false);
});

test('120 net lines boundary on zero and positive baselines', () => {
  const zeroAt119 = evaluateAmplification({
    origNet: 0,
    fixAdded: 119,
    fixDeleted: 0,
    fixNet: 119,
  });
  assert.equal(zeroAt119.amplificationRatio, null);
  assert.equal(zeroAt119.triggered, false);

  const zeroAt120 = evaluateAmplification({
    origNet: 0,
    fixAdded: 120,
    fixDeleted: 0,
    fixNet: 120,
  });
  assert.equal(zeroAt120.amplificationRatio, null);
  assert.equal(zeroAt120.triggered, true);

  const posAt119 = evaluateAmplification({
    origNet: 100,
    fixAdded: 119,
    fixDeleted: 0,
    fixNet: 119,
  });
  assert.equal(posAt119.amplificationRatio, 1.19);
  assert.equal(posAt119.triggered, false);

  const posAt120 = evaluateAmplification({
    origNet: 100,
    fixAdded: 120,
    fixDeleted: 0,
    fixNet: 120,
  });
  assert.equal(posAt120.amplificationRatio, 1.2);
  assert.equal(posAt120.triggered, true);
});

test('25% deletion ratio boundary on zero and positive baselines', () => {
  // 40 / 160 = 0.25 -> must NOT trigger (< 0.25 required)
  const at25Zero = evaluateAmplification({
    origNet: 0,
    fixAdded: 160,
    fixDeleted: 40,
    fixNet: 120,
  });
  assert.equal(at25Zero.deletionRatio, 0.25);
  assert.equal(at25Zero.triggered, false);

  // 39 / 160 = 0.244 (< 0.25) -> MUST trigger
  const below25Zero = evaluateAmplification({
    origNet: 0,
    fixAdded: 160,
    fixDeleted: 39,
    fixNet: 121,
  });
  assert.equal(below25Zero.deletionRatio, 0.244);
  assert.equal(below25Zero.triggered, true);

  const at25Positive = evaluateAmplification({
    origNet: 150,
    fixAdded: 160,
    fixDeleted: 40,
    fixNet: 120,
  });
  assert.equal(at25Positive.deletionRatio, 0.25);
  assert.equal(at25Positive.triggered, false);
});

test('baseline anchor filters non-substantive bot badge reviews and prefers post-draft reviews', () => {
  const devinBadgeOnly = {
    state: 'COMMENTED',
    submitted_at: '2026-11-24T10:00:00Z',
    commit_id: 'aaaa111',
    user: { login: 'devin-ai-integration', type: 'Bot' },
    body: '## 🔍 Devin Review: 3 flags\n\nNot posted on this PR by your GitHub settings',
  };
  const emptyCommentEnvelope = {
    state: 'COMMENTED',
    submitted_at: '2026-11-24T10:05:00Z',
    commit_id: 'bbbb222',
    user: { login: 'alice', type: 'User' },
    body: '   ',
  };
  const realReview = {
    state: 'CHANGES_REQUESTED',
    submitted_at: '2026-11-24T12:00:00Z',
    commit_id: 'cccc333',
    user: { login: 'bob', type: 'User' },
    body: 'Please refactor the camera lifecycle state machine.',
  };

  assert.equal(isSubstantiveReview(devinBadgeOnly), false);
  assert.equal(isSubstantiveReview(emptyCommentEnvelope), false);
  assert.equal(isSubstantiveReview(realReview), true);

  const draftBotComment = {
    created_at: '2026-11-24T10:30:00Z',
    commit_id: 'dddd444',
    path: 'packages/kit/src/Foo.tsx',
    user: { login: 'coderabbitai', type: 'Bot' },
  };
  const postDraftComment = {
    created_at: '2026-11-24T11:30:00Z',
    commit_id: 'eeee555',
    path: 'packages/kit/src/Foo.tsx',
    user: { login: 'alice', type: 'User' },
  };
  const authorReply = {
    created_at: '2026-11-24T11:45:00Z',
    commit_id: 'ffff666',
    in_reply_to_id: 123,
    path: 'packages/kit/src/Foo.tsx',
    user: { login: 'pr-author', type: 'User' },
  };

  const selected = selectEarliestReviewAnchor({
    reviews: [devinBadgeOnly, emptyCommentEnvelope, realReview],
    comments: [draftBotComment, postDraftComment, authorReply],
    readyForReviewAt: '2026-11-24T11:00:00Z',
    prAuthor: 'pr-author',
  });

  assert.equal(selected.earliest?.sha, 'eeee555');
  assert.equal(selected.reviewFileCounts['packages/kit/src/Foo.tsx'], 2);
});

test('findPreReviewCommitFromLog recovers pre-review commit after git rebase refreshes committerDate', () => {
  // Simulates `git rebase` at 2026-11-25T09:00:00Z where committerDate is newer
  // than earliestAt (2026-11-24T14:00:00Z), but authorDate preserves original history.
  const logOutput = [
    'fix2222\t2026-11-24T16:00:00Z\t2026-11-25T09:00:02Z',
    'fix1111\t2026-11-24T15:00:00Z\t2026-11-25T09:00:01Z',
    'base000\t2026-11-24T13:30:00Z\t2026-11-25T09:00:00Z',
  ].join('\n');

  const sha = findPreReviewCommitFromLog(logOutput, '2026-11-24T14:00:00Z');
  assert.equal(sha, 'base000');
});

test('reconcileBaseAdvancedStats strips upstream base-branch noise from shared files', () => {
  const origStats = {
    entries: [
      { file: 'packages/kit/src/Shared.tsx', added: 20, deleted: 5, net: 15 },
    ],
  };
  const currStats = {
    entries: [
      { file: 'packages/kit/src/Shared.tsx', added: 30, deleted: 5, net: 25 },
      { file: 'packages/kit/src/OnlyInPr.tsx', added: 15, deleted: 3, net: 12 },
    ],
  };
  // Suppose upstream `x` added 200 lines to Shared.tsx between origBase and currentBase
  const rawFixStats = {
    entries: [
      { file: 'packages/kit/src/Shared.tsx', added: 210, deleted: 0, net: 210 },
      { file: 'packages/kit/src/OnlyInPr.tsx', added: 15, deleted: 3, net: 12 },
    ],
    untrackedFiles: [],
  };

  const reconciled = reconcileBaseAdvancedStats(
    origStats,
    currStats,
    rawFixStats,
    new Set(['packages/kit/src/Shared.tsx']),
  );

  assert.equal(reconciled.added, 25);
  assert.equal(reconciled.deleted, 3);
  assert.equal(reconciled.net, 22);
});

test('Nash Equilibrium payoff catches multi-dimensional sub-cliff patch spinning and rewards convergent refactoring', () => {
  // Case 1: Sub-cliff patch spinning (95 net lines < 120, 3 state flags < 4, 8 branches, 3 comments on same file)
  // Passes individual raw cliffs, but fails Nash Equilibrium payoff due to combined entropy + cluster penalty.
  const spinEq = evaluateEquilibrium({
    origNet: 180,
    fixAdded: 100,
    fixDeleted: 5,
    fixNet: 95,
    netStateFlags: 3,
    netBranches: 8,
    reviewFileCounts: { 'packages/kit/src/Scanner.tsx': 3 },
    fileEntries: [
      { file: 'packages/kit/src/Scanner.tsx', added: 100, deleted: 5, net: 95 },
    ],
  });
  assert.equal(spinEq.clusteredFiles.length, 1);
  assert.ok(
    spinEq.netPayoff < 0,
    `expected negative payoff, got ${spinEq.netPayoff}`,
  );
  assert.equal(spinEq.triggered, true);
  assert.equal(spinEq.dominantStrategy, 'CONVERGENT_REFACTOR');
  assert.match(
    formatCliEquilibriumLine(spinEq),
    /strategy=CONVERGENT_REFACTOR \[FAIL\]$/,
  );

  // Case 2: Convergent refactor on the same clustered file (deleted old state flags & branches, del/add >= 40%)
  const refactorEq = evaluateEquilibrium({
    origNet: 180,
    fixAdded: 140,
    fixDeleted: 70,
    fixNet: 70,
    netStateFlags: -2,
    netBranches: -3,
    reviewFileCounts: { 'packages/kit/src/Scanner.tsx': 3 },
    fileEntries: [
      {
        file: 'packages/kit/src/Scanner.tsx',
        added: 140,
        deleted: 70,
        net: 70,
      },
    ],
  });
  assert.equal(refactorEq.clusteredFiles.length, 0);
  assert.ok(refactorEq.refactorCredit > 0);
  assert.ok(refactorEq.netPayoff > 0);
  assert.equal(refactorEq.triggered, false);
  assert.equal(refactorEq.dominantStrategy, 'CONVERGED_LOCAL_FIX');

  // Case 3: Large multi-file review fix that meets >= 25% deletion ratio (PR #14759 / #14760 shape)
  // Does not falsely trigger equilibrium gate when code is actively deleted/replaced.
  const multiFileRefactorEq = evaluateEquilibrium({
    origNet: 807,
    fixAdded: 510,
    fixDeleted: 167,
    fixNet: 343,
    netStateFlags: 1,
    netBranches: 21,
    reviewFileCounts: {
      'packages/kit/src/StockSimpleChart.tsx': 3,
      'packages/kit/src/UntouchedFile.tsx': 3,
    },
    fileEntries: [
      {
        file: 'packages/kit/src/StockSimpleChart.tsx',
        added: 61,
        deleted: 16,
        net: 45,
      },
    ],
  });
  assert.equal(multiFileRefactorEq.clusteredFiles.length, 0);
  assert.equal(multiFileRefactorEq.triggered, false);
});

test('GitHub Actions workflow renders null amplificationRatio as N/A without 999 placeholder', () => {
  const workflowPath = path.join(
    repoRoot,
    '.github/workflows/pr-review-bloat-gate.yml',
  );
  const workflowText = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflowText, /amp\.amplificationRatio === null/);
  assert.match(workflowText, /N\/A \(baseline net growth is zero\)/);
  assert.match(workflowText, /Nash Equilibrium Payoff/);
  assert.doesNotMatch(workflowText, /999/);
});

test('excludes lockfiles, manifests, Podfile, generated code, e2e, and node-test files', () => {
  for (const excluded of [
    'yarn.lock',
    'package.json',
    'apps/mobile/ios/Podfile',
    'apps/mobile/ios/Podfile.lock',
    'development/generated/icons/index.ts',
    'packages/shared/src/foo.generated.ts',
    'apps/web/e2e/sw-error-auto-reload.e2e.js',
    'e2e/helpers/setup.ts',
    'development/scripts/check-bloat.node-test.mjs',
    'packages/kit/src/foo.test.tsx',
  ]) {
    assert.equal(
      isTargetCodeFile(excluded),
      false,
      `expected excluded: ${excluded}`,
    );
  }

  for (const included of [
    'packages/kit/src/views/ScanQrCode/components/CameraSwitchButton.tsx',
    'development/scripts/check-bloat.mjs',
  ]) {
    assert.equal(
      isTargetCodeFile(included),
      true,
      `expected included: ${included}`,
    );
  }
});
