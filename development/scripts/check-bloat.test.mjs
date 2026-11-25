import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import {
  ZERO_BASELINE_RATIO_LABEL,
  collectBenchmarkWindow,
  evaluateAmplification,
  evaluateComplexityScore,
  formatAmplificationRatio,
  formatCliAmplificationLine,
  isSubstantiveReview,
  isTargetCodeFile,
  resolveBenchmarkQuery,
  selectEarliestReviewAnchor,
  summarizeBenchmarkResults,
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

async function renderWorkflowReport(report) {
  const workflow = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/pr-review-bloat-gate.yml'),
    'utf8',
  );
  const script = workflow
    .split('            const fs = require', 2)[1]
    .replace(/^ {12}/gm, '');
  const output = {};
  await runInNewContext(`(async () => { const fs = require${script} })()`, {
    require: () => ({ readFileSync: () => JSON.stringify(report) }),
    context: {
      payload: { pull_request: { number: 1 } },
      repo: { owner: 'example', repo: 'test' },
    },
    github: {
      paginate: async () => [],
      rest: {
        issues: {
          createComment: async ({ body }) => {
            output.body = body;
          },
        },
      },
    },
    core: {
      setFailed: (message) => {
        output.failure = message;
      },
    },
    process: { env: {} },
  });
  return output;
}

test('workflow uses artifact thresholds and keeps advisory metrics independent of its verdict', async () => {
  const report = {
    verdict: 'PASS',
    preReviewSha: '1111111111',
    baselineSource: 'review',
    thresholds: {
      minFixNetLines: 120,
      maxAmplificationRatio: 0.5,
      minDeletionRatio: 0.25,
      maxNetStateFlags: 4,
    },
    amplification: {
      origNet: 0,
      amplificationRatio: null,
      fixAdded: 90,
      fixDeleted: 0,
      fixNet: 90,
      deletionRatio: 0,
      triggered: false,
    },
    stateFlags: { netStateFlags: 1, triggered: false },
    complexity: {
      score: -10,
      baseBudget: 120,
      lineCredit: 0,
      changeCost: 130,
      hotspots: [],
    },
  };
  const { body, failure } = await renderWorkflowReport(report);
  assert.match(body, /N\/A \(baseline net growth is zero\)/);
  assert.match(body, /ratio ≥ 50% or zero baseline\)/);
  assert.doesNotMatch(body, /300|999/);
  assert.match(body, /Complexity score.*Advisory/);
  assert.equal(failure, undefined);

  delete report.complexity;
  report.thresholds.maxAbsoluteFixNetLines = 300;
  report.verdict = 'REFACTOR_REQUIRED';
  report.amplification.triggered = true;
  const failed = await renderWorkflowReport(report);
  assert.match(failed.body, /or net ≥ 300/);
  assert.doesNotMatch(failed.body, /Complexity score/);
  assert.match(failed.failure, /thresholds exceeded/);
});

test('workflow surfaces an incomplete baseline without reporting a pass', async () => {
  const { body, failure } = await renderWorkflowReport({
    outcome: 'INCOMPLETE',
    skipped: true,
    baselineSource: 'review',
    skipReason: 'review_tree_conflicts_with_current_base',
  });
  assert.match(body, /Incomplete/);
  assert.match(body, /review_tree_conflicts_with_current_base/);
  assert.equal(failure, undefined);
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

test('300 net lines trigger amplification for a large low-deletion PR', () => {
  for (const growth of [299, 300]) {
    const result = evaluateAmplification({
      origNet: 2000,
      fixAdded: growth + 20,
      fixDeleted: 20,
      fixNet: growth,
    });
    assert.equal(result.triggered, growth === 300);
  }
});

test('uses the unrounded deletion ratio for the hard-cap verdict', () => {
  const result = evaluateAmplification({
    origNet: 2000,
    fixAdded: 1001,
    fixDeleted: 250,
    fixNet: 751,
  });
  assert.equal(result.deletionRatio, 0.25);
  assert.equal(result.hardCapReached, true);
  assert.equal(result.triggered, true);
});

test('workflow runs on submitted reviews using the pull request base and head', () => {
  const workflow = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/pr-review-bloat-gate.yml'),
    'utf8',
  );
  assert.match(
    workflow,
    /^  pull_request_review:\n    types:\n      - submitted$/m,
  );
  assert.match(workflow, /if: github\.event\.pull_request\.base\.ref == 'x'/);
  assert.match(
    workflow,
    /PR_BASE: \$\{\{ github\.event\.pull_request\.base\.ref \}\}/,
  );
  assert.match(
    workflow,
    /PR_HEAD: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/,
  );
});

test('keeps approval feedback and filters empty or placeholder review bodies', () => {
  const submitted_at = '2026-11-24T12:00:00Z';
  for (const [state, body, expected] of [
    ['APPROVED', 'Please add cancellation before merging.', true],
    ['APPROVED', '', false],
    ['APPROVED', 'LGTM!', false],
    ['COMMENTED', 'Not posted on this PR by your GitHub settings', false],
    ['COMMENTED', '<!-- codex-review-receipt:v1 -->\n### Codex Review', false],
    ['COMMENTED', '', false],
    ['CHANGES_REQUESTED', '', true],
  ]) {
    assert.equal(isSubstantiveReview({ state, body, submitted_at }), expected);
  }
  const result = selectEarliestReviewAnchor({
    reviews: [
      {
        state: 'APPROVED',
        body: 'Please add cancellation.',
        submitted_at,
        commit_id: 'reviewed',
      },
    ],
  });
  assert.equal(result.earliest.sha, 'reviewed');
});

test('retains the original baseline after a substantive review is dismissed', () => {
  const dismissed = {
    id: 9,
    state: 'DISMISSED',
    submitted_at: '2026-11-24T10:00:00Z',
    commit_id: 'first-reviewed',
    body: 'Please separate retry and cancellation.',
  };
  const laterReview = {
    state: 'CHANGES_REQUESTED',
    submitted_at: '2026-11-24T12:00:00Z',
    commit_id: 'later-reviewed',
  };
  assert.equal(
    selectEarliestReviewAnchor({ reviews: [dismissed, laterReview] }).earliest
      .sha,
    'first-reviewed',
  );

  const emptyReview = { ...dismissed, body: '' };
  assert.equal(
    selectEarliestReviewAnchor({ reviews: [emptyReview, laterReview] }).earliest
      .sha,
    'later-reviewed',
  );
  assert.equal(
    selectEarliestReviewAnchor({
      reviews: [emptyReview, laterReview],
      events: [
        {
          event: 'review_dismissed',
          dismissed_review: { review_id: '9', state: 'changes_requested' },
        },
      ],
    }).earliest.sha,
    'first-reviewed',
  );
});

function inlineComment(id, hour, login, extra = {}) {
  return {
    id,
    created_at: `2026-11-24T${hour}:00:00Z`,
    path: 'Shared.ts',
    original_commit_id: `original-${id}`,
    commit_id: 'latest-head',
    user: { login },
    ...extra,
  };
}

test('keeps the first formal review across draft and ready transitions', () => {
  const result = selectEarliestReviewAnchor({
    events: [
      { event: 'ready_for_review', created_at: '2026-11-24T09:00:00Z' },
      { event: 'convert_to_draft', created_at: '2026-11-24T11:00:00Z' },
      { event: 'ready_for_review', created_at: '2026-11-24T13:00:00Z' },
    ],
    comments: [
      inlineComment(1, '08', 'bot'),
      inlineComment(2, '10', 'reviewer'),
      inlineComment(3, '12', 'reviewer'),
      inlineComment(4, '14', 'reviewer'),
      inlineComment(5, '15', 'another-reviewer', { in_reply_to_id: 2 }),
    ],
  });
  assert.equal(result.earliest.sha, 'original-2');
  assert.deepEqual(result.reviewFileCounts, { 'Shared.ts': 2 });
});

test('reviewer reply to the PR author can anchor at its submitted review commit', () => {
  const result = selectEarliestReviewAnchor({
    prAuthor: 'author',
    reviews: [
      {
        id: 8,
        state: 'COMMENTED',
        submitted_at: '2026-11-24T12:30:00Z',
        commit_id: 'reply-review',
      },
    ],
    comments: [
      inlineComment(1, '10', 'author'),
      inlineComment(2, '12', 'reviewer', {
        in_reply_to_id: 1,
        pull_request_review_id: 8,
      }),
      inlineComment(3, '13', 'reviewer', { in_reply_to_id: 1 }),
    ],
  });
  assert.equal(result.earliest.sha, 'reply-review');
  assert.equal(result.earliest.at, '2026-11-24T12:30:00Z');
  assert.deepEqual(result.reviewFileCounts, { 'Shared.ts': 1 });
});

test('complexity score tracks branches while review hotspots use local growth and churn', () => {
  const input = {
    fixAdded: 430,
    fixDeleted: 320,
    fixNet: 110,
    netStateFlags: 1,
    netBranches: 10,
    fileEntries: [
      {
        file: 'Shared.ts',
        previousFile: 'Before.ts',
        added: 110,
        deleted: 0,
        net: 110,
      },
      { file: 'Rewrite.ts', added: 320, deleted: 320, net: 0 },
    ],
    reviewFileCounts: {
      'Shared.ts': 1,
      'Before.ts': 2,
      'Rewrite.ts': 3,
      'Untouched.ts': 3,
    },
  };
  const result = evaluateComplexityScore(input);
  assert.deepEqual(result.hotspots, [
    {
      file: 'Shared.ts',
      net: 110,
      deletionRatio: 0,
      reviewThreads: 3,
    },
  ]);
  const noReviews = evaluateComplexityScore({ ...input, reviewFileCounts: {} });
  assert.equal(noReviews.score, result.score);
  assert.equal(
    evaluateComplexityScore({ ...input, netBranches: 0 }).score - result.score,
    40,
  );
});

test('benchmark distinguishes failed and incomplete analyses from evaluated coverage', () => {
  const summary = summarizeBenchmarkResults([
    { number: 1, skipped: true, outcome: 'ERROR', error: 'fetch failed' },
    {
      number: 2,
      skipped: true,
      outcome: 'INCOMPLETE',
      skipReason: 'review_commit_unreachable',
    },
    { number: 3, skipped: true, outcome: 'NO_REVIEWS' },
  ]);
  assert.equal(summary.evaluatedCount, 0);
  assert.equal(summary.interventionRate, null);
  assert.equal(summary.otherSkippedCount, 1);
  assert.deepEqual(summary.errorPrs, [{ number: 1, error: 'fetch failed' }]);
  assert.deepEqual(summary.incompletePrs, [
    { number: 2, reason: 'review_commit_unreachable' },
  ]);
});

test('benchmark keeps labeled simulations outside the non-bypassed rate', () => {
  const summary = summarizeBenchmarkResults([
    {
      number: 1,
      verdict: 'PASS',
      amplification: {},
      complexity: { score: -3 },
    },
    {
      number: 2,
      verdict: 'REFACTOR_REQUIRED',
      bypassed: true,
      amplification: {},
    },
  ]);
  assert.equal(summary.evaluatedCount, 2);
  assert.equal(summary.nonBypassedEvaluatedCount, 1);
  assert.equal(summary.interventionRate, 0);
  assert.deepEqual(summary.passedPrs, [{ number: 1, score: -3 }]);
  assert.deepEqual(summary.bypassedSimulations, [
    { number: 2, verdict: 'REFACTOR_REQUIRED' },
  ]);
});

test('weekly benchmark paginates past 300 and stops at the exact UTC cutoff', () => {
  const weekQuery = resolveBenchmarkQuery(
    '7d',
    Date.parse('2026-11-25T16:30:00Z'),
  );
  assert.equal(weekQuery.mode, 'days');
  assert.equal(weekQuery.days, 7);
  assert.equal(weekQuery.sinceMs, Date.parse('2026-11-18T16:30:00Z'));

  const pages = [];
  const prs = collectBenchmarkWindow(weekQuery, (page) => {
    pages.push(page);
    if (page <= 3) {
      return Array.from({ length: 100 }, (_, i) => ({
        number: (page - 1) * 100 + i + 1,
        created_at: '2026-11-24T00:00:00Z',
      }));
    }
    return [
      { number: 301, created_at: '2026-11-18T16:30:00Z' },
      { number: 302, created_at: '2026-11-18T09:00:00Z' },
    ];
  });
  assert.deepEqual(pages, [1, 2, 3, 4]);
  assert.equal(prs.length, 301);
  assert.equal(prs.at(-1).number, 301);

  const countQuery = resolveBenchmarkQuery('50');
  assert.equal(countQuery.mode, 'count');
  assert.equal(countQuery.limit, 50);
});

function createGitFixture(t, checkout = 'checkout') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-bloat-'));
  const cwd = path.join(root, checkout);
  fs.mkdirSync(cwd);
  t.after(() => fs.rmSync(root, { recursive: true }));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'base');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  const write = (file, body) => fs.writeFileSync(path.join(cwd, file), body);
  const commit = () => {
    git('add', '-A');
    git('commit', '-m', 'test fixture');
    return git('rev-parse', 'HEAD');
  };
  const run = (reviewed, env = process.env, launchDirectory = cwd) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          path.join(repoRoot, 'development/scripts/check-bloat.mjs'),
          ...(reviewed
            ? ['--since', reviewed]
            : ['--pr', '1', '--repo', 'example/test']),
          '--base',
          'base',
          '--warn-only',
          '--json',
        ],
        { cwd: launchDirectory, env, encoding: 'utf8' },
      ),
    );
  return { cwd, git, write, commit, run };
}

test('an unreachable review commit does not fall back to a recently amended commit', (t) => {
  const { cwd, write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const value = 1;\n');
  commit();
  const reviewedAt = '2030-11-24T12:00:00Z';
  const mockGh = `
    #!${process.execPath}
    const endpoint = process.argv.at(-1);
    if (endpoint.endsWith('/reviews')) {
      console.log(JSON.stringify([[{
        state: 'COMMENTED',
        submitted_at: '${reviewedAt}',
        body: 'Please add cancellation.',
        commit_id: '1111111111111111111111111111111111111111',
        user: { login: 'reviewer' },
      }]]));
    } else if (endpoint.endsWith('/comments') || endpoint.endsWith('/events')) {
      console.log('[[]]');
    } else {
      console.log(JSON.stringify({ head: { sha: 'HEAD' }, user: { login: 'author' } }));
    }
  `;
  write('gh', mockGh.trimStart());
  fs.chmodSync(path.join(cwd, 'gh'), 0o755);
  const result = run(null, {
    ...process.env,
    PATH: `${cwd}${path.delimiter}${process.env.PATH}`,
  });
  assert.equal(result.verdict, 'INCOMPLETE');
  assert.equal(result.skipReason, 'review_commit_unreachable');
});

test('finds actual shared-file churn and state additions after base advancement and keeps rename context', (t) => {
  const { git, write, commit, run } = createGitFixture(t);
  const context = Array.from(
    { length: 12 },
    (_, i) => `const shared${i} = ${i};\n`,
  ).join('');
  const flags = Array.from(
    { length: 4 },
    (_, i) => `const ref${i} = useRef();\n`,
  ).join('');
  write('Shared.ts', `const upstream = 1;\n${context}`);
  write('Before rename.ts', `${context}${flags}const output = 1;\n`);
  const base = commit();
  git('switch', '-c', 'pr');
  write(
    'Shared.ts',
    `const upstream = 1;\n${context}const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\n`,
  );
  const reviewed = commit();
  git('switch', 'base');
  write('Shared.ts', `const upstream = 2;\n${context}`);
  commit();
  git('switch', 'pr');
  git('merge', 'base', '--no-edit');
  write('Shared.ts', `const upstream = 2;\n${context}${flags}`);
  git('mv', 'Before rename.ts', 'After rename.ts');
  write('After rename.ts', `${context}${flags}const output = 2;\n`);
  const result = run(reviewed);
  assert.equal(result.origBase, base);
  assert.equal(result.amplification.fixAdded, 5);
  assert.equal(result.amplification.fixDeleted, 5);
  assert.equal(result.stateFlags.netStateFlags, 4);
  assert.equal(result.verdict, 'REFACTOR_REQUIRED');
});

test('reports an incomplete comparison if aligning the reviewed tree conflicts', (t) => {
  const { git, write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const value = 0;\n');
  commit();
  git('switch', '-c', 'pr');
  write('Shared.ts', 'const value = 1;\n');
  const reviewed = commit();
  git('switch', 'base');
  write('Shared.ts', 'const value = 2;\n');
  commit();
  git('switch', 'pr');
  git('merge', '-s', 'ours', 'base', '--no-edit');
  const result = run(reviewed);
  assert.equal(result.verdict, 'INCOMPLETE');
  assert.equal(result.skipReason, 'review_tree_conflicts_with_current_base');
});

test('base alignment continues when every conflict is outside the scanned code', (t) => {
  const { git, write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const initial = true;\n');
  write('yarn.lock', 'base lock\n');
  commit();
  git('switch', '-c', 'pr');
  write('yarn.lock', 'reviewed lock\n');
  const reviewed = commit();
  git('switch', 'base');
  write('yarn.lock', 'upstream lock\n');
  commit();
  git('switch', 'pr');
  git('merge', '-s', 'ours', 'base', '--no-edit');
  write('Shared.ts', 'const initial = true;\nconst ref = useRef();\n');
  const result = run(reviewed);
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.amplification.fixAdded, 1);
  assert.equal(result.amplification.fixDeleted, 0);
  assert.equal(result.stateFlags.netStateFlags, 1);
});

test('counts later state changes after editing a multiline template closing line', (t) => {
  const { write, commit, run } = createGitFixture(t);
  const context = Array.from(
    { length: 24 },
    (_, i) => `const v${i} = ${i};\n`,
  ).join('');
  const initial = `const title = \`\nfirst line\n\`;\n${context}`;
  write('Shared.ts', initial);
  const reviewed = commit();
  const flags = Array.from(
    { length: 4 },
    (_, i) => `const ref${i} = useRef();\n`,
  ).join('');
  write('Shared.ts', initial.replace('`;\n', 'last line`;\n') + flags);
  const report = run(reviewed);
  assert.equal(report.stateFlags.netStateFlags, 4);
  assert.equal(report.verdict, 'REFACTOR_REQUIRED');
});

test('backticks in regular-expression literals preserve subsequent executable hooks', (t) => {
  const { write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const initial = true;\n');
  const reviewed = commit();
  const flags = Array.from(
    { length: 4 },
    (_, i) => `const ref${i} = useRef();\n`,
  ).join('');
  write(
    'Shared.ts',
    `const initial = true;\nconst fence = /^(\`{3,}|~{3,})/;\n${flags}`,
  );
  const report = run(reviewed);
  assert.equal(report.stateFlags.netStateFlags, 4);
  assert.equal(report.verdict, 'REFACTOR_REQUIRED');
});

test('scans refs after unchanged regex operands of logical operators', (t) => {
  const { write, commit, run } = createGitFixture(t);
  const initial = [
    'const first = value && /[`~]/.test(value);',
    'const second = value || /[`~]/;',
    'const third = value ?? /[`~]/;',
    '',
  ].join('\n');
  write('Shared.ts', initial);
  const reviewed = commit();
  const flags = Array.from(
    { length: 4 },
    (_, i) => `const flag${i} = useRef();\n`,
  ).join('');
  write('Shared.ts', `${initial}${flags}`);
  const report = run(reviewed);
  assert.equal(report.stateFlags.netStateFlags, 4);
  assert.equal(report.verdict, 'REFACTOR_REQUIRED');
});

test('scans both sides of a tracked file type change and ignores large excluded patches', (t) => {
  const { cwd, write, commit, run } = createGitFixture(t);
  write('Old.ts', 'const oldFlag = useRef();\n');
  write('Shared.ts', 'const initial = true;\n');
  write('generated.json', '{}\n');
  const reviewed = commit();

  fs.unlinkSync(path.join(cwd, 'Old.ts'));
  fs.symlinkSync('Shared.ts', path.join(cwd, 'Old.ts'));
  write('Shared.ts', 'const replacement = useRef();\n');
  write(
    'generated.json',
    JSON.stringify({ data: 'x'.repeat(21 * 1024 * 1024) }),
  );

  const report = run(reviewed);
  assert.equal(report.verdict, 'PASS');
  assert.equal(report.filesChecked, 2);
  assert.equal(report.stateFlags.netStateFlags, 0);
  assert.equal(report.amplification.fixAdded, 2);
  assert.equal(report.amplification.fixDeleted, 2);
});

test('keeps a file-to-directory change separate from its new descendants', (t) => {
  const { cwd, git, write, commit, run } = createGitFixture(t);
  write('Source.ts', 'const oldRef = useRef();\n');
  const reviewed = commit();
  fs.unlinkSync(path.join(cwd, 'Source.ts'));
  fs.mkdirSync(path.join(cwd, 'Source.ts'));
  write('Source.ts/Child.ts', 'const movedRef = useRef();\n');
  git('add', '-A');
  const report = run(reviewed);
  assert.equal(report.verdict, 'PASS');
  assert.equal(report.filesChecked, 2);
  assert.equal(report.stateFlags.netStateFlags, 0);
});

test('a rename scans exact paths even when its old path becomes a directory', (t) => {
  const { cwd, git, write, commit, run } = createGitFixture(t);
  const oldFile = 'Source[1].ts';
  const newFile = 'Moved?.ts';
  const initial = [
    ...Array.from({ length: 3 }, (_, i) => `const oldRef${i} = useRef();`),
    ...Array.from({ length: 20 }, (_, i) => `const stable${i} = ${i};`),
    '',
  ].join('\n');
  write(oldFile, initial);
  const reviewed = commit();

  git('mv', oldFile, newFile);
  fs.mkdirSync(path.join(cwd, oldFile));
  write(`${oldFile}/Child.ts`, 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
  write(newFile, `${initial}const added = useRef();\n`);
  git('add', '-A');

  const report = run(reviewed);
  assert.equal(report.filesChecked, 2);
  assert.equal(report.stateFlags.netStateFlags, 1);
  assert.equal(report.verdict, 'PASS');
});

test('scans root paths from a subdirectory of a checkout ending in a space', (t) => {
  const { cwd, git, write, commit, run } = createGitFixture(t, 'checkout ');
  const subdirectory = path.join(cwd, 'development', 'scripts');
  fs.mkdirSync(subdirectory, { recursive: true });
  const file = 'development/scripts/Shared.ts';
  write(file, 'const initial = true;\n');
  const reviewed = commit();
  git('switch', '-c', 'fix');
  write(file, 'const flag = useRef();\n');
  commit();
  assert.equal(
    run(reviewed, process.env, subdirectory).stateFlags.netStateFlags,
    1,
  );
});

test('scans tracked changes with literal Git path parsing enabled in the environment', (t) => {
  const { write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const initial = true;\n');
  const reviewed = commit();
  const flags = Array.from(
    { length: 4 },
    (_, index) => `const ref${index} = useRef();\n`,
  ).join('');
  write('Shared.ts', `const initial = true;\n${flags}`);
  // cspell:ignore PATHSPECS
  const report = run(reviewed, { ...process.env, GIT_LITERAL_PATHSPECS: '1' });
  assert.equal(report.stateFlags.netStateFlags, 4);
  assert.equal(report.verdict, 'REFACTOR_REQUIRED');
});

test('preserves hooks after a regular expression in a spread yield operand', (t) => {
  const { write, commit, run } = createGitFixture(t);
  const initial = 'function* patterns() { return [...yield /[`~]/]; }\n';
  write('Shared.js', initial);
  const reviewed = commit();
  const flags = Array.from(
    { length: 4 },
    (_, index) => `const ref${index} = useRef();\n`,
  ).join('');
  write('Shared.js', `${initial}${flags}`);
  const report = run(reviewed);
  assert.equal(report.stateFlags.netStateFlags, 4);
  assert.equal(report.verdict, 'REFACTOR_REQUIRED');
});

test('keeps division after a CommonJS await identifier and recognizes a delimited awaited regex', (t) => {
  const { write, commit, run } = createGitFixture(t);
  write('Shared.cjs', 'const initial = true;\n');
  const reviewed = commit();
  write(
    'Shared.cjs',
    [
      'function ratio(await, flag, units, g) {',
      '  const spaced = await / (flag ? 2 : 3) / units;',
      '  return spaced + await / (flag ? 4 : 5) /g;',
      '}',
      'async function read() { const pattern = await /[`~]/; return pattern; }',
      'const ref = useRef();',
      '',
    ].join('\n'),
  );
  const report = run(reviewed);
  assert.equal(report.stateFlags.netBranches, 2);
  assert.equal(report.stateFlags.netStateFlags, 1);
});

for (const { name, expression } of [
  {
    name: 'flagged await',
    expression: 'async function read() { return await /[`~]/i; }',
  },
  {
    name: 'commented yield',
    expression: 'function* scan() { yield /[`~]/ /* annotation */; }',
  },
]) {
  test(`counts added hooks after a ${name} regex operand`, (t) => {
    const { write, commit, run } = createGitFixture(t);
    const initial = `${expression}\n`;
    write('Shared.cjs', initial);
    const reviewed = commit();
    const flags = Array.from(
      { length: 4 },
      (_, i) => `const ref${i} = useRef();\n`,
    ).join('');
    write('Shared.cjs', `${initial}${flags}`);

    const report = run(reviewed);
    assert.equal(report.stateFlags.netStateFlags, 4);
    assert.equal(report.verdict, 'REFACTOR_REQUIRED');
  });
}

test('emits a verdict for an existing expression deep enough to exhaust a parser stack', (t) => {
  const { write, commit, run } = createGitFixture(t);
  const initial = `const deep = ${'('.repeat(8000)}0${')'.repeat(8000)};\n`;
  write('Shared.js', initial);
  const reviewed = commit();
  const flags = Array.from(
    { length: 4 },
    (_, i) => `const ref${i} = useRef();\n`,
  ).join('');
  write('Shared.js', `${initial}${flags}`);

  const report = run(reviewed);
  assert.equal(report.stateFlags.netStateFlags, 4);
  assert.equal(report.verdict, 'REFACTOR_REQUIRED');
});

test('keeps source offsets through multibyte characters and template interpolations', (t) => {
  const { write, commit, run } = createGitFixture(t);
  const initial = 'const initial = "测试 🧪";\n';
  write('Shared.tsx', initial);
  const reviewed = commit();
  write(
    'Shared.tsx',
    [
      initial.trimEnd(),
      `const label = \`if useRef() 🧪 \${flag ? useState() : value} else\`;`,
      'const component = <Text>if useReducer() 测试 🧪 {useRef()}</Text>;',
      '',
    ].join('\n'),
  );
  const report = run(reviewed);
  assert.equal(report.stateFlags.netStateFlags, 2);
  assert.equal(report.stateFlags.netBranches, 1);
});

test('runs standalone under an older workflow without the parser installed', (t) => {
  const { cwd, write, commit } = createGitFixture(t);
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'check-bloat-standalone-')),
  );
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const checker = path.join(directory, 'check-bloat.mjs');
  fs.copyFileSync(
    path.join(repoRoot, 'development/scripts/check-bloat.mjs'),
    checker,
  );
  write('Shared.js', 'const initial = true;\n');
  const reviewed = commit();
  const flags = Array.from(
    { length: 4 },
    (_, i) => `const ref${i} = useRef();\n`,
  ).join('');
  write('Shared.js', `const initial = true;\n${flags}`);

  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [checker, '--since', reviewed, '--base', 'base', '--warn-only', '--json'],
      {
        cwd,
        env: { ...process.env, NODE_PATH: '' },
        encoding: 'utf8',
      },
    ),
  );
  assert.equal(report.stateFlags.netStateFlags, 4);
  assert.equal(report.verdict, 'REFACTOR_REQUIRED');
});

test('keeps executable tokens after quoted JSX text', (t) => {
  const { write, commit, run } = createGitFixture(t);
  const initial = 'const copy = <Text>escape ` if needed</Text>;\n';
  write('Shared.tsx', initial);
  const reviewed = commit();
  write('Shared.tsx', `${initial}const ref = useRef();\n`);

  const report = run(reviewed);
  assert.equal(report.stateFlags.netStateFlags, 1);
  assert.equal(report.stateFlags.netBranches, 0);
});

test('preserves literal operands and distinguishes member names followed by division', (t) => {
  const { write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const initial = true;\n');
  const reviewed = commit();
  write(
    'Shared.ts',
    [
      "const label = isDapp ? 'DApp' : 'Website';",
      'const value = totals.yield / (isFresh ? current : fallback) / units;',
      'const pretty = isDapp ? `DApp` : `Website`;',
      'const adjusted = total . return / (isFresh ? current : fallback) / units;',
      '',
    ].join('\n'),
  );
  assert.equal(run(reviewed).stateFlags.netBranches, 4);
});

test('counts ternaries with optional chaining and nullish coalescing inside an arm', (t) => {
  const { write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const initial = true;\n');
  const reviewed = commit();
  write(
    'Shared.ts',
    [
      'const url = isDapp ? dApp?.url : webSite?.url;',
      'const backup = isDapp ? dApp.url ?? defaultUrl : webSite.url;',
      'const options = defaults ?? { timeout: 500 };',
      '',
    ].join('\n'),
  );
  assert.equal(run(reviewed).stateFlags.netBranches, 2);
});

test('scans nested template expressions for state and translated copy', (t) => {
  const { write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const initial = true;\n');
  const reviewed = commit();
  write(
    'Shared.ts',
    [
      'const initial = true;',
      `const copy = \`if ETranslations.fake \${render({ title: \`catch \${intl.formatMessage({ id: ETranslations.real })}\`, state: useRef() })}\`;`,
      '',
    ].join('\n'),
  );
  const report = run(reviewed);
  assert.equal(report.stateFlags.netBranches, 0);
  assert.equal(report.stateFlags.netStateFlags, 1);
  assert.equal(report.scopeCreepWarnings.length, 1);
  assert.match(report.scopeCreepWarnings[0].detail, /ETranslations.real$/);
});

test('branch-heavy changes appear in the score without literals or an extra hard gate', (t) => {
  const { write, commit, run } = createGitFixture(t);
  write('Shared.ts', 'const reviewed = true;\n');
  const reviewed = commit();
  const lines = [
    'const example = "Try again if disconnected";',
    "const url = 'https://example.com'; if (url) { start(); }",
    'const text = `catch and switch`;',
    'let isReady = false;',
    'const options = defaults ?? { timeout: 500 };',
    ...Array.from({ length: 9 }, (_, i) => `if (value === ${i}) { start(); }`),
    ...Array.from({ length: 97 }, (_, i) => `const value${i} = ${i};`),
  ];
  write('Shared.ts', `const reviewed = true;\n${lines.join('\n')}\n`);
  const result = run(reviewed);
  assert.equal(result.stateFlags.netBranches, 10);
  assert.equal(result.stateFlags.netStateFlags, 1);
  assert.ok(result.complexity.score < 0);
  assert.equal(result.verdict, 'PASS');
});
