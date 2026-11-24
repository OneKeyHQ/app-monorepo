import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ZERO_BASELINE_RATIO_LABEL,
  evaluateAmplification,
  formatAmplificationRatio,
  formatCliAmplificationLine,
  isTargetCodeFile,
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

test('GitHub Actions workflow renders null amplificationRatio as N/A without 999 placeholder', () => {
  const workflowPath = path.join(
    repoRoot,
    '.github/workflows/pr-review-bloat-gate.yml',
  );
  const workflowText = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflowText, /amp\.origNet === 0/);
  assert.match(workflowText, /amp\.amplificationRatio === null/);
  assert.match(workflowText, /N\/A \(baseline net growth is zero\)/);
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
    'development/scripts/check-bloat.test.mjs',
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
