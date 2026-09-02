#!/usr/bin/env node

/*
 * Cross-commit Account Selector A/B driver.
 *
 * PR mode is the default: the baseline is merge-base(candidate, origin/x).
 * Trend mode uses DEFAULT_PINNED_X_COMMIT and is explicitly selected with
 * RENDER_BASELINE_BASE_MODE=trend. RENDER_BASELINE_X_COMMIT overrides either.
 *
 * Each target is checked out in a reusable local clone and receives the same
 * byte-identical harness from this worktree. The default protocol runs three
 * balanced groups: ABBA, BAAB, ABBA. This yields six adjacent baseline /
 * candidate pairs while balancing warm-cache, thermal and order effects.
 * RENDER_BASELINE_GROUPS changes the group count.
 *
 * Phase metrics are aggregated from paired candidate/baseline ratios. The
 * summary stores every raw sample plus median, MAD and IQR. Missing phases,
 * required metrics or comparable environment/config fields fail measurement;
 * they cannot produce a PASS. The hard gate covers rendered components,
 * commits, max rendered in one commit, and background reload fan-out.
 * Duration and responsiveness metrics remain warning-only. Gate regressions
 * exit 2; measurement/comparability failures exit 1.
 */

// cspell:ignore BAAB pgrep hardlink hardlinks checkoutable

const { execFileSync, spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DECISIVE_PHASE,
  aggregatePairedMeasurements,
  buildBalancedSchedule,
  buildPairedMeasurements,
  evaluatePairedRegressionGate,
  formatPercent,
  summarizeDistribution,
  validateComparableMeasurements,
} = require('./render-baseline-protocol');

const repoRoot = path.resolve(__dirname, '../../..');

// Long-term trend anchor. PR mode does not use it.
const DEFAULT_PINNED_X_COMMIT = 'a830dee4bbcee70217c127ec369432cd15c4b14e';

const HARNESS_RELATIVE_PATH = 'apps/web/e2e/render-commit-baseline.e2e.js';
const METRICS_VERSION = 6;
const RUN_SCRIPT_NAME = 'test:e2e:web:render-baseline';
const RUN_SCRIPT_COMMAND = 'node apps/web/e2e/render-commit-baseline.e2e.js';
const DEFAULT_GROUPS = 3;

const clonesRoot =
  process.env.RENDER_BASELINE_CLONES_DIR ||
  path.join(repoRoot, '.tmp', 'render-baseline-clones');
const outputDir = path.join(repoRoot, '.tmp', 'render-baseline');
const runsDir = path.join(outputDir, 'runs');

function parseBooleanEnv(value) {
  if (value === undefined) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

const FRESH_CLONES = parseBooleanEnv(process.env.RENDER_BASELINE_FRESH);
const CLEANUP_CLONES = parseBooleanEnv(process.env.RENDER_BASELINE_CLEANUP);

function log(message) {
  console.log(`[compare] ${message}`);
}

function banner(lines) {
  const width = Math.max(...lines.map((line) => line.length)) + 4;
  const bar = '!'.repeat(width);
  console.log(`\n${bar}`);
  for (const line of lines) {
    console.log(`! ${line.padEnd(width - 4)} !`);
  }
  console.log(`${bar}\n`);
}

function yarnBin() {
  return process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

function hasCommit(cwd, sha) {
  return tryGit(['cat-file', '-e', `${sha}^{commit}`], cwd) !== null;
}

function commitSubject(cwd, sha) {
  return tryGit(['log', '-1', '--format=%s', sha], cwd) || '(subject unknown)';
}

// Streams a child process's output to the console with a per-target prefix
// (splitting on \r too, so git/yarn progress does not buffer forever) and
// tees the raw bytes into logFile for post-mortem diagnosis.
function runStreaming({ args, command, cwd, env, logFile, prefix }) {
  return new Promise((resolve, reject) => {
    const logStream = logFile
      ? fs.createWriteStream(logFile, { flags: 'a' })
      : undefined;
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const pending = { stderr: '', stdout: '' };
    const emitLines = (streamName, chunk) => {
      const value = pending[streamName] + chunk.toString();
      const lines = value.split(/[\r\n]+/);
      pending[streamName] = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim().length) {
          process.stdout.write(`${prefix} ${line}\n`);
        }
      }
    };
    child.stdout.on('data', (chunk) => {
      logStream?.write(chunk);
      emitLines('stdout', chunk);
    });
    child.stderr.on('data', (chunk) => {
      logStream?.write(chunk);
      emitLines('stderr', chunk);
    });
    child.on('error', (error) => {
      logStream?.end();
      reject(error);
    });
    child.on('close', (code) => {
      for (const rest of [pending.stdout, pending.stderr]) {
        if (rest.trim().length) {
          process.stdout.write(`${prefix} ${rest}\n`);
        }
      }
      logStream?.end();
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} ${args.join(' ')} exited with code ${code}` +
              `${logFile ? ` (log: ${logFile})` : ''}`,
          ),
        );
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Pre-flight
// ---------------------------------------------------------------------------

function assertNoConcurrentMeasurement() {
  // Comparable numbers require an otherwise idle machine; refuse to stack a
  // measurement on top of another harness or account-selector e2e run.
  let pids = '';
  try {
    pids = execFileSync(
      'pgrep',
      ['-f', 'render-commit-baseline|account-selector.e2e'],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    pids = ''; // pgrep exits non-zero when nothing matches
  }
  if (pids) {
    throw new Error(
      'Another render measurement or account-selector e2e appears to be ' +
        `running (pids: ${pids.split('\n').join(', ')}). Back-to-back numbers ` +
        'are only comparable on an idle machine; wait for it to finish (or ' +
        'kill it) and retry.',
    );
  }
  log(
    'reminder: numbers are only comparable when nothing else heavy runs on ' +
      'this machine during the two measurements',
  );
}

function resolveGroups() {
  const raw = process.env.RENDER_BASELINE_GROUPS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_GROUPS;
  }
  const groups = Number(raw);
  if (!Number.isInteger(groups) || groups <= 0) {
    throw new Error(
      `RENDER_BASELINE_GROUPS=${raw} must be a positive integer ` +
        `(default ${DEFAULT_GROUPS})`,
    );
  }
  return groups;
}

function resolveBaselineCommit(candidateSha) {
  const override = process.env.RENDER_BASELINE_X_COMMIT;
  if (override) {
    const resolved = /^[0-9a-f]{40}$/.test(override)
      ? override
      : tryGit(['rev-parse', `${override}^{commit}`], repoRoot);
    if (!resolved) {
      throw new Error(
        `RENDER_BASELINE_X_COMMIT=${override} does not resolve to a commit in ` +
          `${repoRoot}. Run \`git fetch origin x\` first, or pass a full sha.`,
      );
    }
    return {
      mode: 'explicit',
      sha: resolved,
      source: `RENDER_BASELINE_X_COMMIT (${override})`,
    };
  }

  const mode = process.env.RENDER_BASELINE_BASE_MODE || 'pr';
  if (mode === 'trend') {
    return {
      mode,
      sha: DEFAULT_PINNED_X_COMMIT,
      source: 'pinned long-term trend baseline',
    };
  }
  if (mode !== 'pr') {
    throw new Error(
      `RENDER_BASELINE_BASE_MODE=${mode} must be either "pr" or "trend"`,
    );
  }
  const originX = tryGit(
    ['rev-parse', 'refs/remotes/origin/x^{commit}'],
    repoRoot,
  );
  if (!originX) {
    throw new Error(
      'refs/remotes/origin/x is unavailable. Run `git fetch origin x` and retry.',
    );
  }
  const mergeBase = tryGit(['merge-base', candidateSha, originX], repoRoot);
  if (!mergeBase) {
    throw new Error(
      `Unable to resolve merge-base between candidate ${candidateSha} and ` +
        `origin/x ${originX}`,
    );
  }
  return {
    mode,
    originX,
    sha: mergeBase,
    source: `merge-base(candidate, origin/x ${originX.slice(0, 7)})`,
  };
}

function resolveCandidateCommit() {
  const target = process.env.RENDER_BASELINE_CANDIDATE_COMMIT || 'HEAD';
  const sha = tryGit(['rev-parse', `${target}^{commit}`], repoRoot);
  if (!sha) {
    throw new Error(
      `RENDER_BASELINE_CANDIDATE_COMMIT=${target} does not resolve to a ` +
        `commit in ${repoRoot}`,
    );
  }
  return {
    sha,
    source:
      target === 'HEAD'
        ? 'HEAD'
        : `RENDER_BASELINE_CANDIDATE_COMMIT (${target})`,
  };
}

function assertBaselineShaReachable(xSha) {
  // Hard requirement: the clones hardlink this repo's object store, so the
  // pinned commit must exist HERE for the detached checkout to work.
  if (!hasCommit(repoRoot, xSha)) {
    throw new Error(
      `Baseline commit ${xSha} is not present in the local repository. Run ` +
        `\`git fetch origin x\` in ${repoRoot} and retry.`,
    );
  }
  // Soft sanity check only: with direct checkout, ancestry of origin/x is no
  // longer needed for reachability, but a pinned commit that is not on the
  // local origin/x usually means a typo'd sha or a stale remote-tracking ref,
  // so it is worth a warning.
  const originX = tryGit(['rev-parse', 'refs/remotes/origin/x'], repoRoot);
  if (!originX) {
    log(
      'WARNING: refs/remotes/origin/x does not exist locally; cannot sanity ' +
        'check that the baseline commit is on x',
    );
    return null;
  }
  const isAncestor =
    tryGit(['merge-base', '--is-ancestor', xSha, originX], repoRoot) !== null;
  if (!isAncestor && xSha !== originX) {
    log(
      `WARNING: baseline commit ${xSha} is not an ancestor of local ` +
        `origin/x (${originX}) - measuring it anyway, but verify it really ` +
        'is an x commit (or run `git fetch origin x` to refresh the ref)',
    );
  }
  return originX;
}

// ---------------------------------------------------------------------------
// Clone preparation
// ---------------------------------------------------------------------------

function cloneIsAtSha(dir, sha) {
  return (
    fs.existsSync(path.join(dir, '.git')) &&
    tryGit(['rev-parse', 'HEAD'], dir) === sha
  );
}

function cloneHasInstall(dir) {
  return fs.existsSync(path.join(dir, 'node_modules'));
}

// One strategy for both targets: a --no-checkout clone of the LOCAL repo by
// plain path (git's local transport hardlinks the object database -
// near-instant, near-zero additional disk for .git) followed by a detached
// checkout of the exact sha. Because the object store is shared, any commit
// present in the local repository is directly checkoutable - branch names
// (including the often-stale local `x`) are never trusted, and a source HEAD
// moving mid-run cannot invalidate the clone.
function prepareClone({ label, sha }) {
  const dir = path.join(clonesRoot, `${label}-${sha.slice(0, 7)}`);
  if (!FRESH_CLONES && cloneIsAtSha(dir, sha)) {
    log(`${label} clone reused at ${dir}`);
    return { dir, reusedClone: true };
  }
  fs.rmSync(dir, { force: true, recursive: true });
  log(`${label} clone: local hardlink clone + detached checkout of ${sha}`);
  git(['clone', '--no-checkout', '--quiet', repoRoot, dir], repoRoot);
  git(
    ['-c', 'advice.detachedHead=false', 'checkout', '--detach', '--quiet', sha],
    dir,
  );
  if (!cloneIsAtSha(dir, sha)) {
    throw new Error(`${label} clone at ${dir} is not at expected ${sha}`);
  }
  return { dir, reusedClone: false };
}

async function installDependencies({ dir, logFile, prefix }) {
  if (cloneHasInstall(dir)) {
    log(`${prefix} node_modules present, skipping yarn install`);
    return { reusedInstall: true };
  }
  log(`${prefix} yarn install (about 2 minutes with a warm cache)`);
  await runStreaming({
    args: ['install'],
    command: yarnBin(),
    cwd: dir,
    env: process.env,
    logFile,
    prefix,
  });
  return { reusedInstall: false };
}

// ---------------------------------------------------------------------------
// Harness propagation (candidate clone -> x clone, byte-identical)
// ---------------------------------------------------------------------------

function ensureRunScript(cloneDir, label) {
  const packageJsonPath = path.join(cloneDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  if (pkg.scripts[RUN_SCRIPT_NAME] === RUN_SCRIPT_COMMAND) {
    return;
  }
  pkg.scripts[RUN_SCRIPT_NAME] = RUN_SCRIPT_COMMAND;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  log(`${label}: injected ${RUN_SCRIPT_NAME} script into package.json`);
}

function propagateHarness(sourceRoot, targetClones) {
  const source = path.join(sourceRoot, HARNESS_RELATIVE_PATH);
  if (!fs.existsSync(source)) {
    throw new Error(
      `Harness source does not contain ${HARNESS_RELATIVE_PATH}: ${sourceRoot}`,
    );
  }
  for (const { dir, label } of targetClones) {
    const target = path.join(dir, HARNESS_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    if (!fs.readFileSync(source).equals(fs.readFileSync(target))) {
      throw new Error(
        `Harness copy into the ${label} clone is not byte-identical`,
      );
    }
    ensureRunScript(dir, `[${label}]`);
  }
  const sha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(source))
    .digest('hex');
  log(
    `harness propagated byte-identical from worktree into all clones ` +
      `(sha256 ${sha256})`,
  );
  return { path: source, sha256 };
}

// ---------------------------------------------------------------------------
// Measurement runs
// ---------------------------------------------------------------------------

async function runMeasurement({ cloneDir, label, logFile, runArtifactDir }) {
  fs.rmSync(runArtifactDir, { force: true, recursive: true });
  fs.mkdirSync(runArtifactDir, { recursive: true });
  const startedAt = Date.now();
  log(`${label} measurement starting in ${cloneDir}`);
  await runStreaming({
    args: [RUN_SCRIPT_NAME],
    command: yarnBin(),
    cwd: cloneDir,
    env: {
      ...process.env,
      // Artifacts land in THIS repo's .tmp, one directory per run, so the
      // driver never has to guess sha-derived filenames inside the clones.
      RENDER_BASELINE_ARTIFACT_DIR: runArtifactDir,
      WEB_E2E_HEADLESS: process.env.WEB_E2E_HEADLESS || 'true',
    },
    logFile,
    prefix: label,
  });
  const artifacts = fs
    .readdirSync(runArtifactDir)
    .filter((name) => name.endsWith(`-v${METRICS_VERSION}.json`));
  if (artifacts.length !== 1) {
    throw new Error(
      `Expected exactly one -v${METRICS_VERSION}.json artifact in ` +
        `${runArtifactDir}, found ${artifacts.length}`,
    );
  }
  const artifactPath = path.join(runArtifactDir, artifacts[0]);
  log(
    `${label} measurement finished in ` +
      `${Math.round((Date.now() - startedAt) / 1000)}s, artifact ${artifactPath}`,
  );
  return artifactPath;
}

// ---------------------------------------------------------------------------
// Regression gate
// ---------------------------------------------------------------------------

// Default threshold for the regression gate. With the harness's warm-up
// removing the first-iteration lazy-mount spike, back-to-back 5-sample
// medians of the gated count metrics vary within roughly 10% run to run on an
// idle machine; 1.3 sits well above that noise while still failing on the
// multi-x regressions this baseline exists to guard.
const DEFAULT_GATE_FACTOR = 1.3;

// Default ON; RENDER_BASELINE_GATE=0 disables the gate entirely.
function isGateEnabled() {
  const value = process.env.RENDER_BASELINE_GATE;
  if (value === undefined) {
    return true;
  }
  return parseBooleanEnv(value);
}

function resolveGateFactor() {
  const raw = process.env.RENDER_BASELINE_GATE_FACTOR;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_GATE_FACTOR;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `RENDER_BASELINE_GATE_FACTOR=${raw} must be a positive number ` +
        `(default ${DEFAULT_GATE_FACTOR})`,
    );
  }
  return value;
}

function assertComparableMeasurements(measurements) {
  const issues = validateComparableMeasurements(measurements, METRICS_VERSION);
  if (issues.length === 0) {
    return;
  }
  for (const issue of issues) {
    log(`COMPARABILITY FAILURE: ${issue}`);
  }
  throw new Error(
    `Measurements are not comparable (${issues.length} hard failure(s))`,
  );
}

function printPairedComparison(aggregate) {
  const metrics = [
    ['renderedComponents', 'rendered components'],
    ['commits', 'React commits'],
    ['maxRenderedInCommit', 'max rendered in one commit'],
    ['nextPaintRenderedComponents', 'rendered components by next paint'],
    ['nextPaintCommits', 'React commits by next paint'],
    ['nextPaintWallMs', 'next-paint wall ms'],
    ['actualDurationMs', 'actualDuration ms'],
    ['maxInteractionLatencyMs', 'max interaction latency ms'],
    ['maxLongAnimationFrameMs', 'max Long Animation Frame ms'],
    ['diagnostics.reloadsStarted', 'reload calls'],
    ['diagnostics.reloadDurationTotalMs', 'reload duration ms'],
  ];
  for (const [metric, title] of metrics) {
    const rows = aggregate.phases
      .filter((phase) => phase.metrics[metric])
      .map((phase) => {
        const result = phase.metrics[metric];
        const ratio = result.pairedRatio;
        return {
          'baseline median': result.baseline.median,
          'candidate median': result.candidate.median,
          change: formatPercent(ratio?.median),
          'paired IQR': ratio?.iqr ?? 'n/a',
          'paired MAD': ratio?.mad ?? 'n/a',
          evidence: result.classification.direction,
          phase:
            phase.phase === DECISIVE_PHASE ? `${phase.phase} **` : phase.phase,
        };
      });
    if (rows.length) {
      console.log(`\n${title} (${aggregate.pairCount} paired samples):`);
      console.table(rows);
    }
  }
}

function aggregateBoot(measurements) {
  const pairs = buildPairedMeasurements(measurements);
  return Object.fromEntries(
    ['commits', 'renderedComponents', 'actualDurationMs'].map((metric) => {
      const samples = pairs.map((pair) => {
        const baseline = pair.baseline.artifact.boot[metric];
        const candidate = pair.candidate.artifact.boot[metric];
        let ratio = null;
        if (baseline !== 0) {
          ratio = candidate / baseline;
        } else if (candidate === 0) {
          ratio = 1;
        }
        return {
          baseline,
          candidate,
          group: pair.group,
          pair: pair.pair,
          ratio,
        };
      });
      const ratios = samples
        .map(({ ratio }) => ratio)
        .filter((ratio) => typeof ratio === 'number' && Number.isFinite(ratio));
      return [
        metric,
        {
          baseline: summarizeDistribution(
            samples.map(({ baseline }) => baseline),
          ),
          candidate: summarizeDistribution(
            samples.map(({ candidate }) => candidate),
          ),
          pairedRatio: ratios.length ? summarizeDistribution(ratios) : null,
          samples,
        },
      ];
    }),
  );
}

function applyPairedRegressionGate(aggregate, gateConfig) {
  if (!gateConfig.enabled) {
    return { enabled: false };
  }
  const verdict = evaluatePairedRegressionGate(aggregate, gateConfig.factor);
  for (const warning of verdict.warnings) {
    log(`gate WARNING: ${warning}`);
  }
  if (verdict.pass) {
    log(
      `regression threshold: PASS across ${aggregate.pairCount} paired ` +
        `samples; evidence=${verdict.evidenceStatus}`,
    );
  } else {
    for (const failure of verdict.failures) {
      log(`gate REGRESSION: ${failure}`);
    }
  }
  return { enabled: true, ...verdict };
}

// ---------------------------------------------------------------------------
// Clone cache maintenance
// ---------------------------------------------------------------------------

function pruneCloneCache(keepDirs) {
  if (!fs.existsSync(clonesRoot)) {
    return;
  }
  for (const name of fs.readdirSync(clonesRoot)) {
    const fullPath = path.join(clonesRoot, name);
    // Only ever touch directories the driver itself created.
    const isDriverClone = /^(x|candidate)-[0-9a-f]{7,40}$/.test(name);
    const keep = keepDirs.includes(fullPath) && !CLEANUP_CLONES;
    if (isDriverClone && !keep) {
      log(`removing clone ${fullPath}`);
      fs.rmSync(fullPath, { force: true, recursive: true });
    }
  }
  if (CLEANUP_CLONES) {
    log('RENDER_BASELINE_CLEANUP=1: clone cache removed');
  } else {
    log(
      `clone cache kept for reuse at ${clonesRoot} (about 8GB per clone; ` +
        'purge with `rm -rf` or RENDER_BASELINE_CLEANUP=1)',
    );
  }
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  assertNoConcurrentMeasurement();

  // Validate the gate configuration up front: a bad
  // RENDER_BASELINE_GATE_FACTOR must fail here, not after two ~4-minute
  // measurements.
  const gateConfig = isGateEnabled()
    ? { enabled: true, factor: resolveGateFactor() }
    : { enabled: false };
  if (gateConfig.enabled) {
    log(
      `regression gate armed (factor ${gateConfig.factor}; ` +
        'RENDER_BASELINE_GATE=0 disables)',
    );
  } else {
    log('regression gate: DISABLED via RENDER_BASELINE_GATE');
  }

  const candidate = resolveCandidateCommit();
  const candidateSha = candidate.sha;
  const baseline = resolveBaselineCommit(candidateSha);
  const xSha = baseline.sha;
  const localOriginX = assertBaselineShaReachable(xSha);
  const groups = resolveGroups();
  const schedule = buildBalancedSchedule(groups);
  const currentHeadSha = git(['rev-parse', 'HEAD'], repoRoot);
  const candidateBranch =
    candidateSha === currentHeadSha
      ? git(['branch', '--show-current'], repoRoot)
      : '(historical detached target)';
  const worktreeDirty = git(['status', '--porcelain'], repoRoot) !== '';

  log(`baseline (x): ${xSha} [${baseline.source}]`);
  log(`  ${commitSubject(repoRoot, xSha)}`);
  if (localOriginX !== xSha) {
    log(`  note: local origin/x has moved on to ${localOriginX}`);
  }
  log(
    `candidate:    ${candidateSha} ` +
      `[${candidate.source}${candidateBranch ? `; ${candidateBranch}` : ''}]`,
  );
  log(`  ${commitSubject(repoRoot, candidateSha)}`);
  if (xSha === candidateSha) {
    log('WARNING: baseline and candidate are the same commit');
  }
  log(
    `measurement protocol: ${groups} balanced group(s), ` +
      `${schedule.length} runs, ${groups * 2} paired samples`,
  );
  if (worktreeDirty) {
    banner([
      'WORKTREE IS DIRTY: product code still comes from exact commits.',
      'The benchmark harness intentionally comes from this worktree;',
      'its SHA-256 is recorded so every target uses identifiable,',
      'byte-identical benchmark code.',
    ]);
  }

  fs.mkdirSync(clonesRoot, { recursive: true });
  fs.mkdirSync(runsDir, { recursive: true });
  const runId = new Date()
    .toISOString()
    .replace(/\..+$/, '')
    .replace(/[-:]/g, '')
    .replace('T', '-');
  const prepareLog = (label) =>
    path.join(runsDir, `${runId}-${label}-prepare.log`);
  const measureLog = (label) =>
    path.join(runsDir, `${runId}-${label}-measure.log`);

  if (FRESH_CLONES) {
    log('RENDER_BASELINE_FRESH=1: ignoring any cached clones');
  }
  const candidateClone = prepareClone({
    label: 'candidate',
    sha: candidateSha,
  });
  const xClone = prepareClone({ label: 'x', sha: xSha });
  const candidateInstall = await installDependencies({
    dir: candidateClone.dir,
    logFile: prepareLog('candidate'),
    prefix: '[candidate]',
  });
  const xInstall = await installDependencies({
    dir: xClone.dir,
    logFile: prepareLog('x'),
    prefix: '[x]',
  });

  // Re-propagated on every run (even with cached clones) so historical product
  // commits are measured by the same corrected worktree harness.
  const harness = propagateHarness(repoRoot, [
    { dir: candidateClone.dir, label: 'candidate' },
    { dir: xClone.dir, label: 'x' },
  ]);

  const cloneByTarget = {
    baseline: xClone,
    candidate: candidateClone,
  };
  const measurements = [];
  try {
    for (const run of schedule) {
      const runLabel = `g${run.group}-r${run.position}-${run.target}`;
      const artifactPath = await runMeasurement({
        cloneDir: cloneByTarget[run.target].dir,
        label: `[${runLabel}]`,
        logFile: measureLog(runLabel),
        runArtifactDir: path.join(runsDir, `${runId}-${runLabel}`),
      });
      measurements.push({
        ...run,
        artifact: JSON.parse(fs.readFileSync(artifactPath, 'utf8')),
        artifactPath,
        label: runLabel,
      });
    }
  } catch (error) {
    banner([
      'A measurement run FAILED. Clones and logs are kept for diagnosis:',
      `x clone:         ${xClone.dir}`,
      `candidate clone: ${candidateClone.dir}`,
      `logs + partial artifacts: ${runsDir} (run id ${runId})`,
    ]);
    throw error;
  }

  assertComparableMeasurements(measurements);
  const aggregate = aggregatePairedMeasurements(measurements);

  console.log(
    `\n=== Render baseline comparison: x ${xSha.slice(0, 7)} vs candidate ` +
      `${candidateSha.slice(0, 7)} ===`,
  );
  printPairedComparison(aggregate);
  const boot = aggregateBoot(measurements);
  const gate = applyPairedRegressionGate(aggregate, gateConfig);

  const pairName = `compare-${xSha.slice(0, 7)}-vs-${candidateSha.slice(0, 7)}-${runId}`;
  const rawArtifacts = measurements.map((measurement) => {
    const rawArtifact = path.join(
      outputDir,
      `${pairName}-g${measurement.group}-r${measurement.position}-${measurement.target}-raw.json`,
    );
    fs.copyFileSync(measurement.artifactPath, rawArtifact);
    return { ...measurement, rawArtifact };
  });
  const baselineMeasurements = rawArtifacts.filter(
    ({ target }) => target === 'baseline',
  );
  const candidateMeasurements = rawArtifacts.filter(
    ({ target }) => target === 'candidate',
  );
  const firstBaseline = baselineMeasurements[0].artifact;
  const firstCandidate = candidateMeasurements[0].artifact;

  const summary = {
    boot,
    candidate: {
      branch: candidateBranch || '(detached)',
      clone: candidateClone.dir,
      environment: firstCandidate.environment,
      git: firstCandidate.git,
      rawArtifacts: candidateMeasurements.map(({ rawArtifact }) => rawArtifact),
      reusedClone: candidateClone.reusedClone,
      reusedInstall: candidateInstall.reusedInstall,
      sha: candidateSha,
    },
    churnEmits: firstBaseline.churnEmits,
    comparedAt: new Date().toISOString(),
    driver: {
      arch: os.arch(),
      nodeVersion: process.version,
      platform: process.platform,
    },
    fixture: firstBaseline.fixture,
    harness,
    gate,
    iterations: firstBaseline.iterations,
    measurements: rawArtifacts.map(
      ({ artifact, artifactPath, ...measurement }) => measurement,
    ),
    metricsVersion: METRICS_VERSION,
    phases: aggregate.phases,
    protocol: {
      classificationMethod: aggregate.classificationMethod,
      groups,
      pairedSamples: aggregate.pairCount,
      schedule,
    },
    warnings: gate.warnings || [],
    worktreeDirty,
    x: {
      clone: xClone.dir,
      environment: firstBaseline.environment,
      git: firstBaseline.git,
      mode: baseline.mode,
      originX: baseline.originX,
      rawArtifacts: baselineMeasurements.map(({ rawArtifact }) => rawArtifact),
      reusedClone: xClone.reusedClone,
      reusedInstall: xInstall.reusedInstall,
      sha: xSha,
      source: baseline.source,
    },
  };
  const summaryPath = path.join(outputDir, `${pairName}.json`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  log(`summary: ${summaryPath}`);
  log(`raw artifacts: ${rawArtifacts.length} files beside the summary`);

  pruneCloneCache([candidateClone.dir, xClone.dir]);

  log(`total wall time: ${Math.round((Date.now() - startedAt) / 1000)}s`);

  if (gate.enabled === true && gate.pass === false) {
    // Distinct exit path from a measurement failure (which throws and exits
    // with code 1): both measurements succeeded, the comparison and summary
    // were fully written, and THIS exit is the gate verdict.
    banner([
      'REGRESSION GATE FAILED (both measurements succeeded; this is the',
      `gate verdict, not a run failure). Factor: ${gate.factor}.`,
      ...gate.failures,
      `Per-phase numbers: "gate" object in ${summaryPath}`,
      'RENDER_BASELINE_GATE=0 disables the gate;',
      'RENDER_BASELINE_GATE_FACTOR overrides the threshold.',
    ]);
    process.exitCode = 2;
  }
}

// Exported for self-tests; requiring this file never runs main().
module.exports = {
  isGateEnabled,
  resolveGateFactor,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
