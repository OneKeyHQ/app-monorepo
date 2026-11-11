const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const YAML = require('yaml');

const {
  DAILY_BUILD_WORKFLOW_PATH,
  SigningProvenanceError,
  verifyDailyBuildRun,
} = require('./verify-daily-build-run');

const SHA = 'a'.repeat(40);
const ANCESTOR_SHA = 'b'.repeat(40);
const REPOSITORY = 'OneKeyHQ/app-monorepo';
const BRANCH = 'feature/windows-signing';
const RUN_ID = '42947920039';
const WORKFLOW_DIR = path.join(__dirname, '..', 'workflows');

function runRecord(overrides = {}) {
  return {
    path: DAILY_BUILD_WORKFLOW_PATH,
    head_repository: { full_name: REPOSITORY },
    head_branch: BRANCH,
    head_sha: SHA,
    ...overrides,
  };
}

function verify(options = {}) {
  const calls = { runs: [], compares: [] };
  const verified = verifyDailyBuildRun({
    runId: options.runId ?? RUN_ID,
    repository: REPOSITORY,
    refName: BRANCH,
    sha: SHA,
    log: () => {},
    fetchRun: ({ repository, runId }) => {
      calls.runs.push({ repository, runId });
      if (options.fetchRunError) throw options.fetchRunError;
      return options.run ?? runRecord();
    },
    fetchCompareStatus: (args) => {
      calls.compares.push(args);
      if (options.compareError) throw options.compareError;
      return options.compareStatus ?? 'ahead';
    },
  });
  return { verified, calls };
}

function expectProvenanceError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof SigningProvenanceError,
      `expected SigningProvenanceError, got ${error?.constructor?.name}`,
    );
    assert.match(error.message, pattern);
    return true;
  });
}

function workflow(name) {
  return YAML.parse(fs.readFileSync(path.join(WORKFLOW_DIR, name), 'utf8'));
}

test('accepts a daily-build run for the packaged commit', () => {
  const { verified, calls } = verify();
  assert.equal(verified, true);
  assert.deepEqual(calls.runs, [{ repository: REPOSITORY, runId: RUN_ID }]);
  assert.deepEqual(calls.compares, []);
});

test('accepts a daily-build run whose commit is an ancestor', () => {
  const { verified, calls } = verify({
    run: runRecord({ head_sha: ANCESTOR_SHA }),
    compareStatus: 'ahead',
  });
  assert.equal(verified, true);
  assert.deepEqual(calls.compares, [
    { repository: REPOSITORY, base: ANCESTOR_SHA, head: SHA },
  ]);
});

test('accepts an identical compare result', () => {
  const { verified } = verify({
    run: runRecord({ head_sha: ANCESTOR_SHA }),
    compareStatus: 'identical',
  });
  assert.equal(verified, true);
});

test('rejects a run from another workflow', () => {
  expectProvenanceError(
    () =>
      verify({
        run: runRecord({ path: '.github/workflows/release-desktop-all.yml' }),
      }),
    /not a daily-build run/u,
  );
});

test('rejects a run from another repository', () => {
  expectProvenanceError(
    () =>
      verify({
        run: runRecord({ head_repository: { full_name: 'someone/fork' } }),
      }),
    /belongs to someone\/fork/u,
  );
});

test('rejects a run for another branch', () => {
  expectProvenanceError(
    () => verify({ run: runRecord({ head_branch: 'release/v6.6.4' }) }),
    /built release\/v6\.6\.4, but this dispatch packages/u,
  );
});

test('rejects a run that is not an ancestor of the packaged commit', () => {
  expectProvenanceError(
    () =>
      verify({
        run: runRecord({ head_sha: ANCESTOR_SHA }),
        compareStatus: 'diverged',
      }),
    /not an ancestor/u,
  );
});

test('rejects a malformed run id without calling the API', () => {
  expectProvenanceError(
    () =>
      verifyDailyBuildRun({
        runId: 'run-42',
        repository: REPOSITORY,
        refName: BRANCH,
        sha: SHA,
        log: () => {},
        fetchRun: () => assert.fail('fetchRun must not be called'),
        fetchCompareStatus: () => assert.fail('compare must not be called'),
      }),
    /must be numeric/u,
  );
});

test('stays unsigned when no upstream run id is provided', () => {
  const { verified, calls } = verify({ runId: '' });
  assert.equal(verified, false);
  assert.deepEqual(calls.runs, []);
  assert.deepEqual(calls.compares, []);
});

test('surfaces run lookup failures', () => {
  expectProvenanceError(
    () => verify({ fetchRunError: new Error('HTTP 404') }),
    /Failed to read run/u,
  );
});

test('surfaces compare lookup failures', () => {
  expectProvenanceError(
    () =>
      verify({
        run: runRecord({ head_sha: ANCESTOR_SHA }),
        compareError: new Error('HTTP 502'),
      }),
    /Failed to compare/u,
  );
});

test('release-desktop-all wires provenance into the Windows signing gate', () => {
  const document = workflow('release-desktop-all.yml');
  const verifyJob = document.jobs['windows-signing-source'];
  assert.ok(verifyJob, 'missing windows-signing-source job');
  const verifyStep = verifyJob.steps.find((step) => step.id === 'verify');
  assert.ok(verifyStep, 'missing verify step');
  assert.match(
    verifyStep.run,
    /node \.github\/scripts\/verify-daily-build-run\.js/u,
  );
  assert.equal(
    verifyJob.outputs.upstream_verified,
    // oxlint-disable-next-line no-template-curly-in-string -- comparing a YAML expression literal
    '${{ steps.verify.outputs.upstream_verified }}',
  );

  const windowsJob = document.jobs['package-win'];
  assert.ok(
    windowsJob.needs.includes('windows-signing-source'),
    'package-win must depend on the provenance job',
  );
  assert.match(
    windowsJob.environment,
    /needs\.windows-signing-source\.outputs\.upstream_verified == 'true'/u,
  );
  assert.match(
    windowsJob.env.WIN_HSM_SIGNING_ENABLED,
    /needs\.windows-signing-source\.outputs\.upstream_verified == 'true'/u,
  );
});

test('daily-build dispatches its own run id for provenance', () => {
  const document = workflow('daily-build.yml');
  const dispatch = document.jobs['daily-build'].steps.find(
    (step) => step.name === 'Dispatch desktop release',
  );
  assert.ok(dispatch, 'missing Dispatch desktop release step');
  assert.match(dispatch.run, /inputs\[upstream_run_id\]=\$\{GITHUB_RUN_ID\}/u);
});
