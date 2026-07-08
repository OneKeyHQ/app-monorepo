#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  fetchReviewThreads,
  getThreads,
  reviewThreadDataFlags,
  rootComment,
  threadComments,
} = require('./agent-github-review');

const SCHEMA_VERSION = 1;
const VALID_PROFILES = new Set(['commit', 'pr', 'ci']);
const RELEASE_READY_GATE = 'release-ready-merge-gate';
const LINT_WORKTREE_EXCLUDED_FILES = new Set([
  'packages/shared/src/locale/enum/translations.ts',
  'packages/shared/src/locale/localeJsonMap.ts',
]);
const JAVASCRIPT_LINT_FILE_RE = /\.(?:cjs|js|jsx|mjs)$/u;
const TYPESCRIPT_LINT_FILE_RE = /\.(?:cts|mts|ts|tsx)$/u;

let jsonStdout = false;

function humanLog(message = '') {
  if (jsonStdout) {
    console.error(message);
  } else {
    console.log(message);
  }
}

function parseArgs(argv) {
  const args = {
    profile: 'commit',
    pr: '',
    json: false,
    jsonFile: '',
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--json-file') {
      args.jsonFile = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--json-file=')) {
      args.jsonFile = arg.slice('--json-file='.length);
    } else if (arg === '--profile') {
      args.profile = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--profile=')) {
      args.profile = arg.slice('--profile='.length);
    } else if (arg === '--pr') {
      args.pr = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--pr=')) {
      args.pr = arg.slice('--pr='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!VALID_PROFILES.has(args.profile)) {
    throw new Error(
      `Invalid profile "${args.profile}". Expected one of: ${[
        ...VALID_PROFILES,
      ].join(', ')}`,
    );
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  yarn agent:check --profile commit',
    '  yarn agent:check --profile pr [--pr 123]',
    '  yarn agent:check --profile ci [--pr 123]',
    '  yarn agent:check --profile ci --json',
    '  yarn agent:check --profile ci --json-file /tmp/agent-check.json',
    '',
    'Profiles:',
    '  commit  Run local worktree/staged lint and type checks.',
    '  pr      Run commit checks, then summarize PR CI and reviews when a PR exists.',
    '  ci      Summarize PR CI and reviews only. Requires a PR.',
    '',
    'Machine output:',
    '  --json       Print only the JSON report to stdout; human logs go to stderr.',
    '  --json-file  Write the same stable JSON report to the provided path.',
  ].join('\n');
}

function createLogDir() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(
    process.cwd(),
    'node_modules',
    '.cache',
    'agent-checks',
    timestamp,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function relativeLogPath(logPath) {
  return path.relative(process.cwd(), logPath);
}

function writeCommandLog(logDir, name, command, args, result, durationMs) {
  const fileName = `${name.replace(/[^a-zA-Z0-9._-]/g, '_')}.log`;
  const logPath = path.join(logDir, fileName);
  const content = [
    `$ ${[command, ...args].join(' ')}`,
    `exitCode: ${String(result.status)}`,
    `signal: ${result.signal || ''}`,
    `duration: ${formatDuration(durationMs)}`,
    '',
    '--- stdout ---',
    result.stdout || '',
    '',
    '--- stderr ---',
    result.stderr || '',
  ].join('\n');

  fs.writeFileSync(logPath, content);
  return logPath;
}

function compactCommandResult(result) {
  return {
    name: result.name,
    command: result.command,
    args: result.args,
    ok: result.ok,
    exitCode: result.exitCode,
    signal: result.signal || '',
    durationMs: result.durationMs,
    logPath: result.logPath,
  };
}

function runCommand(logDir, name, command, args) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
  });
  const durationMs = Date.now() - startedAt;
  const logPath = writeCommandLog(
    logDir,
    name,
    command,
    args,
    result,
    durationMs,
  );
  const ok = result.status === 0;

  humanLog(
    `${ok ? 'PASS' : 'FAIL'} ${name} (${formatDuration(
      durationMs,
    )}) log: ${relativeLogPath(logPath)}`,
  );

  return {
    name,
    command,
    args,
    ok,
    exitCode: result.status,
    signal: result.signal,
    durationMs,
    logPath,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function runJsonCommand(logDir, name, command, args) {
  const result = runCommand(logDir, name, command, args);
  let data = null;
  let parseError = '';

  if (result.stdout.trim()) {
    try {
      data = JSON.parse(result.stdout);
    } catch (error) {
      parseError = error.message;
    }
  }

  return {
    ...result,
    data,
    parseError,
    ok: result.ok && !parseError,
  };
}

function splitLines(value) {
  return String(value || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function runGitOutput(args) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} exited with ${String(result.status)}: ${
        result.stderr || result.stdout || ''
      }`,
    );
  }

  return splitLines(result.stdout);
}

function isWorktreeLintTarget(filePath) {
  if (LINT_WORKTREE_EXCLUDED_FILES.has(filePath)) {
    return false;
  }
  return (
    JAVASCRIPT_LINT_FILE_RE.test(filePath) ||
    TYPESCRIPT_LINT_FILE_RE.test(filePath)
  );
}

function getWorktreeLintFiles() {
  const files = [
    ...runGitOutput([
      'diff',
      '--name-only',
      '--diff-filter=ACMR',
      'HEAD',
      '--',
    ]),
    ...runGitOutput(['ls-files', '--others', '--exclude-standard', '--']),
  ];

  return [...new Set(files.filter(isWorktreeLintTarget))].toSorted();
}

function splitLintFiles(files) {
  return {
    js: files.filter((file) => JAVASCRIPT_LINT_FILE_RE.test(file)),
    ts: files.filter((file) => TYPESCRIPT_LINT_FILE_RE.test(file)),
  };
}

function runWorktreeLintChecks(logDir) {
  const files = getWorktreeLintFiles();
  if (!files.length) {
    humanLog('SKIP lint-worktree: no changed JS/TS files.');
    return [];
  }

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const { js, ts } = splitLintFiles(files);
  const results = [];

  if (js.length) {
    results.push(
      runCommand(logDir, 'lint-worktree-js', npx, [
        'oxlint',
        '--fix',
        '--deny-warnings',
        ...js,
      ]),
    );
  }

  if (ts.length) {
    results.push(
      runCommand(logDir, 'lint-worktree-ts', npx, [
        'oxlint',
        '--tsconfig',
        './tsconfig.json',
        '--type-aware',
        '--fix',
        '--deny-warnings',
        ...ts,
      ]),
    );
  }

  return results;
}

function parsePrNumber(input) {
  if (!input) {
    return '';
  }

  const urlMatch = input.match(/\/pull\/(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  if (/^\d+$/.test(input)) {
    return input;
  }

  throw new Error(`Unable to parse PR number from: ${input}`);
}

function detectCurrentBranch(logDir) {
  const result = runCommand(logDir, 'git-current-branch', 'git', [
    'branch',
    '--show-current',
  ]);
  if (!result.ok) {
    return '';
  }
  return result.stdout.trim();
}

function detectPrNumber(logDir, explicitPr) {
  const parsed = parsePrNumber(explicitPr);
  if (parsed) {
    return parsed;
  }

  const branch = detectCurrentBranch(logDir);
  if (!branch) {
    return '';
  }

  const result = runJsonCommand(logDir, 'gh-pr-detect', 'gh', [
    'pr',
    'list',
    '--head',
    branch,
    '--json',
    'number',
  ]);

  if (!result.data || !Array.isArray(result.data) || !result.data[0]) {
    return '';
  }

  return String(result.data[0].number || '');
}

function detectRepo(logDir) {
  const result = runJsonCommand(logDir, 'gh-repo-view', 'gh', [
    'repo',
    'view',
    '--json',
    'owner,name',
  ]);

  if (!result.ok || !result.data) {
    throw new Error(
      `Unable to detect GitHub repository. See ${relativeLogPath(
        result.logPath,
      )}`,
    );
  }

  return {
    owner: result.data.owner.login,
    repo: result.data.name,
  };
}

function lastItem(items) {
  if (!items || !items.length) {
    return null;
  }
  return items[items.length - 1];
}

function compactCheck(check) {
  return {
    name: check.name || '',
    bucket: check.bucket || '',
    state: check.state || '',
    workflow: check.workflow || '',
    link: check.link || '',
    startedAt: check.startedAt || '',
    completedAt: check.completedAt || '',
  };
}

function summarizeChecks(checks) {
  const summary = {
    pass: [],
    failed: [],
    pending: [],
    skipped: [],
    cancelled: [],
    gateFailed: [],
    unknown: [],
  };

  for (const check of checks || []) {
    const bucket = String(check.bucket || '').toLowerCase();
    if (bucket === 'pass') {
      summary.pass.push(compactCheck(check));
    } else if (bucket === 'fail') {
      if (check.name === RELEASE_READY_GATE) {
        summary.gateFailed.push(compactCheck(check));
      } else {
        summary.failed.push(compactCheck(check));
      }
    } else if (bucket === 'pending') {
      summary.pending.push(compactCheck(check));
    } else if (bucket === 'skipping') {
      summary.skipped.push(compactCheck(check));
    } else if (bucket === 'cancel') {
      summary.cancelled.push(compactCheck(check));
    } else {
      summary.unknown.push(compactCheck(check));
    }
  }

  return summary;
}

function checksCounts(summary) {
  return {
    pass: summary.pass.length,
    failed: summary.failed.length,
    pending: summary.pending.length,
    skipped: summary.skipped.length,
    cancelled: summary.cancelled.length,
    gateFailed: summary.gateFailed.length,
    unknown: summary.unknown.length,
  };
}

function getReviewState(view) {
  const reviews = Array.isArray(view.reviews) ? view.reviews : [];
  const latestByUser = new Map();

  for (const review of reviews) {
    const login = review.author && review.author.login;
    if (login) {
      latestByUser.set(login, review);
    }
  }

  return [...latestByUser.values()].filter(
    (review) => review.state === 'CHANGES_REQUESTED',
  );
}

const MERGEABLE_STATES = new Set(['CLEAN', 'HAS_HOOKS']);

function mergeStateFailureReason(value) {
  const status = String(value || '').toUpperCase();
  if (!status || MERGEABLE_STATES.has(status)) {
    return '';
  }
  return `pr-merge-state-blocked:${status}`;
}

function isHardBlockedMergeState(value) {
  return Boolean(mergeStateFailureReason(value));
}

function reviewDecisionFailureReason(value) {
  const decision = String(value || '').toUpperCase();
  if (decision === 'REVIEW_REQUIRED') {
    return 'review-required';
  }
  if (decision === 'CHANGES_REQUESTED') {
    return 'changes-requested';
  }
  return '';
}

function compactThread(thread) {
  const root = rootComment(thread);
  const latest = lastItem(threadComments(thread));
  const body = latest && latest.body ? latest.body.replace(/\s+/g, ' ') : '';

  return {
    id: thread.id || '',
    isResolved: Boolean(thread.isResolved),
    isOutdated: Boolean(thread.isOutdated),
    path: thread.path || '',
    line: thread.line || null,
    startLine: thread.startLine || null,
    diffSide: thread.diffSide || '',
    commentCount: threadComments(thread).length,
    rootComment: root
      ? {
          id: root.id || '',
          databaseId: root.databaseId || null,
          author: root.author && root.author.login ? root.author.login : '',
          createdAt: root.createdAt || '',
        }
      : null,
    latestComment: latest
      ? {
          id: latest.id || '',
          databaseId: latest.databaseId || null,
          author:
            latest.author && latest.author.login ? latest.author.login : '',
          createdAt: latest.createdAt || '',
          bodyPreview: body.length > 240 ? `${body.slice(0, 237)}...` : body,
        }
      : null,
  };
}

function summarizeThreads(threads) {
  const compactThreads = (threads || []).map(compactThread);
  const unresolved = compactThreads.filter((thread) => !thread.isResolved);
  const active = unresolved.filter((thread) => !thread.isOutdated);

  return {
    total: compactThreads.length,
    unresolved,
    active,
  };
}

function printChecks(summary) {
  const counts = checksCounts(summary);
  humanLog(
    `CI checks: ${counts.pass} pass, ${counts.failed} failed, ${counts.pending} pending, ${counts.gateFailed} gate-blocked`,
  );

  const important = [
    ...summary.failed.map((check) => ['failed', check]),
    ...summary.pending.slice(0, 8).map((check) => ['pending', check]),
    ...summary.gateFailed.map((check) => ['gate', check]),
  ];

  for (const [state, check] of important) {
    humanLog(
      `- ${state}: ${check.name}${check.link ? ` (${check.link})` : ''}`,
    );
  }
}

function printThreads(summary) {
  humanLog(
    `Review threads: ${summary.active.length} active unresolved, ${summary.unresolved.length} total unresolved`,
  );

  for (const thread of summary.active.slice(0, 8)) {
    const comment = thread.latestComment;
    const author = comment && comment.author ? comment.author : 'unknown';
    const preview = comment && comment.bodyPreview ? comment.bodyPreview : '';
    humanLog(
      `- ${thread.path}:${thread.line || thread.startLine || '?'} @${author}: ${preview}`,
    );
  }
}

function runLocalChecks(logDir) {
  humanLog('\nLocal checks');
  return [
    ...runWorktreeLintChecks(logDir),
    runCommand(logDir, 'lint-staged', 'yarn', ['lint:staged']),
    runCommand(logDir, 'tsc-staged', 'yarn', ['tsc:staged']),
  ];
}

function buildLocalReport(results, ran) {
  if (!ran) {
    return {
      ran: false,
      status: 'skipped',
      checks: [],
    };
  }

  const checks = results.map(compactCommandResult);
  return {
    ran: true,
    status: checks.every((check) => check.ok) ? 'pass' : 'fail',
    checks,
  };
}

function runRemoteChecks(logDir, explicitPr, required) {
  humanLog('\nGitHub checks');
  const prNumber = detectPrNumber(logDir, explicitPr);

  if (!prNumber) {
    if (required) {
      throw new Error(
        'No PR found. Pass --pr <number-or-url> or push/open a PR first.',
      );
    }
    humanLog('SKIP GitHub checks: no PR found for the current branch.');
    return {
      ran: true,
      skipped: true,
      required,
      status: 'skipped',
      pr: null,
      exitCode: 0,
      checks: null,
      review: null,
      logs: {},
    };
  }

  const { owner, repo } = detectRepo(logDir);
  const view = runJsonCommand(logDir, 'gh-pr-view', 'gh', [
    'pr',
    'view',
    prNumber,
    '--json',
    'state,reviews,comments,reviewDecision,url,mergeStateStatus,isDraft,headRefName,baseRefName',
  ]);
  const checks = runJsonCommand(logDir, 'gh-pr-checks', 'gh', [
    'pr',
    'checks',
    prNumber,
    '--json',
    'bucket,name,state,link,startedAt,completedAt,workflow',
  ]);
  const inlineComments = runJsonCommand(logDir, 'gh-inline-comments', 'gh', [
    'api',
    `repos/${owner}/${repo}/pulls/${prNumber}/comments`,
  ]);

  const threads = fetchReviewThreads({
    logDir,
    owner,
    repo,
    prNumber,
    runJsonCommand,
  });

  if (!view.ok || !view.data) {
    throw new Error(
      `Unable to read PR metadata. See ${relativeLogPath(view.logPath)}`,
    );
  }

  const checksData = Array.isArray(checks.data) ? checks.data : [];
  const checksSummary = summarizeChecks(checksData);
  const reviewThreads = threads.ok ? getThreads(threads.data) : [];
  const threadDataFlags = threads.ok
    ? reviewThreadDataFlags(threads.data)
    : {
        dataComplete: false,
        threadPageTruncated: false,
        commentPageTruncated: false,
      };
  const threadsSummary = summarizeThreads(reviewThreads);
  const changesRequested = getReviewState(view.data);
  const changesRequestedBy = changesRequested.map((review) =>
    review.author && review.author.login ? review.author.login : '',
  );
  const inlineCount = Array.isArray(inlineComments.data)
    ? inlineComments.data.length
    : 0;

  humanLog(`PR: ${view.data.url}`);
  humanLog(
    `State: ${view.data.state}, reviewDecision: ${view.data.reviewDecision}`,
  );
  printChecks(checksSummary);
  humanLog(`Inline comments: ${inlineCount}`);
  if (!threads.ok) {
    humanLog(
      `Review threads: unavailable via GraphQL. See ${relativeLogPath(
        threads.logPath,
      )}`,
    );
  } else {
    printThreads(threadsSummary);
    if (threadsSummary.active.length) {
      humanLog(
        `Review action: yarn agent:review-thread --pr ${prNumber} --list`,
      );
    }
  }

  if (changesRequestedBy.length) {
    humanLog('Changes requested by:');
    for (const login of changesRequestedBy) {
      humanLog(`- ${login}`);
    }
  }

  const hasBlockingState = view.data.state !== 'OPEN';
  const mergeStateStatus = String(
    view.data.mergeStateStatus || '',
  ).toUpperCase();
  const hasDraft = Boolean(view.data.isDraft);
  const hasMergeBlocked = isHardBlockedMergeState(mergeStateStatus);
  const hasBlockingReviewDecision = Boolean(
    reviewDecisionFailureReason(view.data.reviewDecision),
  );
  const hasFailures = checksSummary.failed.length > 0;
  const hasPending = checksSummary.pending.length > 0;
  const hasGateFailure = checksSummary.gateFailed.length > 0;
  const hasThreads = threadsSummary.unresolved.length > 0;
  const hasChangesRequested = changesRequestedBy.length > 0;
  const hasUnavailableRequiredData =
    !checks.ok || !inlineComments.ok || !threads.ok;
  const hasTruncatedReviewData = !threadDataFlags.dataComplete;
  const exitCode =
    hasBlockingState ||
    hasDraft ||
    hasMergeBlocked ||
    hasBlockingReviewDecision ||
    hasFailures ||
    hasPending ||
    hasGateFailure ||
    hasThreads ||
    hasChangesRequested ||
    hasUnavailableRequiredData ||
    hasTruncatedReviewData
      ? 1
      : 0;

  return {
    ran: true,
    skipped: false,
    required,
    status: exitCode === 0 ? 'pass' : 'fail',
    pr: {
      number: Number(prNumber),
      url: view.data.url,
      state: view.data.state,
      reviewDecision: view.data.reviewDecision,
      mergeStateStatus: view.data.mergeStateStatus,
      isDraft: Boolean(view.data.isDraft),
      headRefName: view.data.headRefName,
      baseRefName: view.data.baseRefName,
    },
    exitCode,
    checks: {
      counts: checksCounts(checksSummary),
      failed: checksSummary.failed,
      pending: checksSummary.pending,
      gateFailed: checksSummary.gateFailed,
      skipped: checksSummary.skipped,
      cancelled: checksSummary.cancelled,
      unknown: checksSummary.unknown,
      all: checksData.map(compactCheck),
    },
    review: {
      inlineComments: {
        count: inlineCount,
      },
      threads: {
        total: threadsSummary.total,
        unresolved: threadsSummary.unresolved.length,
        activeUnresolved: threadsSummary.active.length,
        dataComplete: threadDataFlags.dataComplete,
        threadPageTruncated: threadDataFlags.threadPageTruncated,
        commentPageTruncated: threadDataFlags.commentPageTruncated,
        active: threadsSummary.active,
        unresolvedItems: threadsSummary.unresolved,
      },
      changesRequestedBy: changesRequestedBy.filter(Boolean),
    },
    logs: {
      view: view.logPath,
      checks: checks.logPath,
      inlineComments: inlineComments.logPath,
      threads: threads.logPath,
      threadPages: threads.logPaths || [],
    },
  };
}

function failureReasons(report) {
  const reasons = [];

  if (report.local.ran && report.local.status === 'fail') {
    reasons.push('local-checks-failed');
  }

  if (report.remote && report.remote.ran && report.remote.status === 'fail') {
    if (report.remote.pr && report.remote.pr.state !== 'OPEN') {
      reasons.push('pr-not-open');
    }
    if (report.remote.pr && report.remote.pr.isDraft) {
      reasons.push('pr-is-draft');
    }
    if (
      report.remote.pr &&
      report.remote.pr.mergeStateStatus &&
      isHardBlockedMergeState(report.remote.pr.mergeStateStatus)
    ) {
      reasons.push(mergeStateFailureReason(report.remote.pr.mergeStateStatus));
    }
    if (report.remote.pr) {
      const reviewReason = reviewDecisionFailureReason(
        report.remote.pr.reviewDecision,
      );
      if (reviewReason && !reasons.includes(reviewReason)) {
        reasons.push(reviewReason);
      }
    }
    if (report.remote.checks && report.remote.checks.counts.failed > 0) {
      reasons.push('ci-checks-failed');
    }
    if (report.remote.checks && report.remote.checks.counts.pending > 0) {
      reasons.push('ci-checks-pending');
    }
    if (report.remote.checks && report.remote.checks.counts.gateFailed > 0) {
      reasons.push('release-ready-gate-blocked');
    }
    if (report.remote.review && report.remote.review.threads.unresolved) {
      reasons.push('review-threads-unresolved');
    }
    if (
      report.remote.review &&
      report.remote.review.threads.dataComplete === false
    ) {
      reasons.push('review-data-truncated');
    }
    if (
      report.remote.review &&
      report.remote.review.changesRequestedBy.length > 0
    ) {
      reasons.push('changes-requested');
    }
  }

  return reasons;
}

function stableReport(report) {
  return JSON.parse(
    JSON.stringify(report, (key, value) => {
      if (key === 'stdout' || key === 'stderr' || key === 'data') {
        return undefined;
      }
      return value;
    }),
  );
}

function writeReport(logDir, report, args) {
  const reportPath = path.join(logDir, 'summary.json');
  report.summaryPath = reportPath;

  if (args.jsonFile) {
    report.jsonFile = path.resolve(args.jsonFile);
  }

  const output = `${JSON.stringify(stableReport(report), null, 2)}\n`;
  fs.writeFileSync(reportPath, output);

  if (args.jsonFile) {
    fs.mkdirSync(path.dirname(report.jsonFile), { recursive: true });
    fs.writeFileSync(report.jsonFile, output);
    humanLog(`JSON file: ${path.relative(process.cwd(), report.jsonFile)}`);
  }

  humanLog(`\nSummary JSON: ${relativeLogPath(reportPath)}`);

  if (args.json) {
    process.stdout.write(output);
  }
}

function createInitialReport(args, logDir) {
  return {
    schemaVersion: SCHEMA_VERSION,
    tool: 'agent-check',
    generatedAt: new Date().toISOString(),
    cwd: process.cwd(),
    profile: args.profile,
    status: 'running',
    exitCode: null,
    logDir,
    summaryPath: '',
    jsonFile: args.jsonFile ? path.resolve(args.jsonFile) : '',
    input: {
      pr: args.pr,
    },
    local: {
      ran: false,
      status: 'skipped',
      checks: [],
    },
    remote: {
      ran: false,
      skipped: true,
      required: false,
      status: 'skipped',
      pr: null,
      exitCode: 0,
      checks: null,
      review: null,
      logs: {},
    },
    failureReasons: [],
    error: null,
  };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error('');
    console.error(usage());
    process.exit(1);
  }

  jsonStdout = args.json;

  if (args.help) {
    console.log(usage());
    return;
  }

  const logDir = createLogDir();
  const report = createInitialReport(args, logDir);

  humanLog(`Agent check profile: ${args.profile}`);
  humanLog(`Log dir: ${relativeLogPath(logDir)}`);

  try {
    let localResults = [];
    if (args.profile === 'commit' || args.profile === 'pr') {
      localResults = runLocalChecks(logDir);
      report.local = buildLocalReport(localResults, true);
    }

    const localFailed = report.local.ran && report.local.status === 'fail';
    if (!localFailed && (args.profile === 'pr' || args.profile === 'ci')) {
      report.remote = runRemoteChecks(logDir, args.pr, args.profile === 'ci');
    }

    const remoteExitCode = report.remote ? report.remote.exitCode : 0;
    report.exitCode = localFailed || remoteExitCode ? 1 : 0;
    report.status = report.exitCode === 0 ? 'pass' : 'fail';
    report.failureReasons = failureReasons(report);

    writeReport(logDir, report, args);
    process.exit(report.exitCode);
  } catch (error) {
    report.status = 'error';
    report.exitCode = 1;
    report.error = error.message;
    report.failureReasons = ['error'];
    writeReport(logDir, report, args);
    console.error(`\nFAIL ${error.message}`);
    process.exit(1);
  }
}

main();
