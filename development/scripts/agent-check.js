#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const VALID_PROFILES = new Set(['commit', 'pr', 'ci']);
const RELEASE_READY_GATE = 'release-ready-merge-gate';

function parseArgs(argv) {
  const args = {
    profile: 'commit',
    pr: '',
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
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
    '',
    'Profiles:',
    '  commit  Run local staged lint and type checks.',
    '  pr      Run commit checks, then summarize PR CI and reviews when a PR exists.',
    '  ci      Summarize PR CI and reviews only. Requires a PR.',
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

  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${name} (${formatDuration(
      durationMs,
    )}) log: ${path.relative(process.cwd(), logPath)}`,
  );

  return {
    name,
    ok,
    exitCode: result.status,
    signal: result.signal,
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
      `Unable to detect GitHub repository. See ${path.relative(
        process.cwd(),
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
      summary.pass.push(check);
    } else if (bucket === 'fail') {
      if (check.name === RELEASE_READY_GATE) {
        summary.gateFailed.push(check);
      } else {
        summary.failed.push(check);
      }
    } else if (bucket === 'pending') {
      summary.pending.push(check);
    } else if (bucket === 'skipping') {
      summary.skipped.push(check);
    } else if (bucket === 'cancel') {
      summary.cancelled.push(check);
    } else {
      summary.unknown.push(check);
    }
  }

  return summary;
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

function getThreads(graphqlData) {
  return (
    (graphqlData &&
      graphqlData.repository &&
      graphqlData.repository.pullRequest &&
      graphqlData.repository.pullRequest.reviewThreads &&
      graphqlData.repository.pullRequest.reviewThreads.nodes) ||
    []
  );
}

function summarizeThreads(threads) {
  const unresolved = threads.filter((thread) => !thread.isResolved);
  const active = unresolved.filter((thread) => !thread.isOutdated);

  return {
    total: threads.length,
    unresolved,
    active,
  };
}

function printChecks(summary) {
  console.log(
    `CI checks: ${summary.pass.length} pass, ${summary.failed.length} failed, ${summary.pending.length} pending, ${summary.gateFailed.length} gate-blocked`,
  );

  const important = [
    ...summary.failed.map((check) => ['failed', check]),
    ...summary.pending.slice(0, 8).map((check) => ['pending', check]),
    ...summary.gateFailed.map((check) => ['gate', check]),
  ];

  for (const [state, check] of important) {
    console.log(
      `- ${state}: ${check.name}${check.link ? ` (${check.link})` : ''}`,
    );
  }
}

function printThreads(summary) {
  console.log(
    `Review threads: ${summary.active.length} active unresolved, ${summary.unresolved.length} total unresolved`,
  );

  for (const thread of summary.active.slice(0, 8)) {
    const comment = lastItem(thread.comments && thread.comments.nodes);
    const author = comment && comment.author ? comment.author.login : 'unknown';
    const body =
      comment && comment.body ? comment.body.replace(/\s+/g, ' ') : '';
    const preview = body.length > 120 ? `${body.slice(0, 117)}...` : body;
    console.log(
      `- ${thread.path}:${thread.line || thread.startLine || '?'} @${author}: ${preview}`,
    );
  }
}

function runLocalChecks(logDir) {
  console.log('\nLocal checks');
  const results = [
    runCommand(logDir, 'lint-staged', 'yarn', ['lint:staged']),
    runCommand(logDir, 'tsc-staged', 'yarn', ['tsc:staged']),
  ];
  return results;
}

function runRemoteChecks(logDir, explicitPr, required) {
  console.log('\nGitHub checks');
  const prNumber = detectPrNumber(logDir, explicitPr);

  if (!prNumber) {
    if (required) {
      throw new Error(
        'No PR found. Pass --pr <number-or-url> or push/open a PR first.',
      );
    }
    console.log('SKIP GitHub checks: no PR found for the current branch.');
    return {
      skipped: true,
      prNumber: '',
      exitCode: 0,
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

  const query = `
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      id
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 20) {
            nodes {
              id
              databaseId
              body
              author {
                login
              }
              createdAt
            }
          }
        }
      }
    }
  }
}`;

  const threads = runJsonCommand(logDir, 'gh-review-threads', 'gh', [
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `repo=${repo}`,
    '-F',
    `pr=${prNumber}`,
  ]);

  if (!view.ok || !view.data) {
    throw new Error(
      `Unable to read PR metadata. See ${path.relative(process.cwd(), view.logPath)}`,
    );
  }

  const checksData = Array.isArray(checks.data) ? checks.data : [];
  const checksSummary = summarizeChecks(checksData);
  const reviewThreads = threads.ok ? getThreads(threads.data) : [];
  const threadsSummary = summarizeThreads(reviewThreads);
  const changesRequested = getReviewState(view.data);
  const inlineCount = Array.isArray(inlineComments.data)
    ? inlineComments.data.length
    : 0;

  console.log(`PR: ${view.data.url}`);
  console.log(
    `State: ${view.data.state}, reviewDecision: ${view.data.reviewDecision}`,
  );
  printChecks(checksSummary);
  console.log(`Inline comments: ${inlineCount}`);
  if (!threads.ok) {
    console.log(
      `Review threads: unavailable via GraphQL. See ${path.relative(
        process.cwd(),
        threads.logPath,
      )}`,
    );
  } else {
    printThreads(threadsSummary);
  }

  if (changesRequested.length) {
    console.log('Changes requested by:');
    for (const review of changesRequested) {
      console.log(`- ${review.author.login}`);
    }
  }

  const hasBlockingState = view.data.state !== 'OPEN';
  const hasFailures = checksSummary.failed.length > 0;
  const hasPending = checksSummary.pending.length > 0;
  const hasThreads = threadsSummary.active.length > 0;
  const hasChangesRequested = changesRequested.length > 0;
  const hasUnavailableRequiredData =
    !checks.ok || !inlineComments.ok || !threads.ok;
  const exitCode =
    hasBlockingState ||
    hasFailures ||
    hasPending ||
    hasThreads ||
    hasChangesRequested ||
    hasUnavailableRequiredData
      ? 1
      : 0;

  return {
    skipped: false,
    prNumber,
    url: view.data.url,
    exitCode,
    checks: checksSummary,
    reviewThreads: threadsSummary,
    reviewDecision: view.data.reviewDecision,
    changesRequested: changesRequested.map((review) => review.author.login),
    logs: {
      view: view.logPath,
      checks: checks.logPath,
      inlineComments: inlineComments.logPath,
      threads: threads.logPath,
    },
  };
}

function writeReport(logDir, report) {
  const reportPath = path.join(logDir, 'summary.json');
  const compactReport = JSON.parse(
    JSON.stringify(report, (key, value) => {
      if (key === 'stdout' || key === 'stderr' || key === 'data') {
        return undefined;
      }
      return value;
    }),
  );
  fs.writeFileSync(reportPath, `${JSON.stringify(compactReport, null, 2)}\n`);
  console.log(`\nSummary JSON: ${path.relative(process.cwd(), reportPath)}`);
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

  if (args.help) {
    console.log(usage());
    return;
  }

  const logDir = createLogDir();
  const report = {
    profile: args.profile,
    logDir,
    local: [],
    remote: null,
  };

  console.log(`Agent check profile: ${args.profile}`);
  console.log(`Log dir: ${path.relative(process.cwd(), logDir)}`);

  try {
    if (args.profile === 'commit' || args.profile === 'pr') {
      report.local = runLocalChecks(logDir);
    }

    const localFailed = report.local.some((result) => !result.ok);
    if (!localFailed && (args.profile === 'pr' || args.profile === 'ci')) {
      report.remote = runRemoteChecks(logDir, args.pr, args.profile === 'ci');
    }

    writeReport(logDir, report);

    const remoteExitCode = report.remote ? report.remote.exitCode : 0;
    process.exit(localFailed || remoteExitCode ? 1 : 0);
  } catch (error) {
    report.error = error.message;
    writeReport(logDir, report);
    console.error(`\nFAIL ${error.message}`);
    process.exit(1);
  }
}

main();
