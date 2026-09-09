#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  fetchReviewThreads,
  getThreads,
  latestComment,
  rootComment,
} = require('./agent-github-review');

function parseArgs(argv) {
  const args = {
    pr: '',
    thread: '',
    reply: '',
    replyFile: '',
    list: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--list') {
      args.list = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--pr') {
      args.pr = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--pr=')) {
      args.pr = arg.slice('--pr='.length);
    } else if (arg === '--thread') {
      args.thread = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--thread=')) {
      args.thread = arg.slice('--thread='.length);
    } else if (arg === '--reply') {
      args.reply = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--reply=')) {
      args.reply = arg.slice('--reply='.length);
    } else if (arg === '--reply-file') {
      args.replyFile = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--reply-file=')) {
      args.replyFile = arg.slice('--reply-file='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  yarn agent:review-thread --pr 123 --list',
    '  yarn agent:review-thread --pr 123 --thread <thread-id> --reply "Fixed: ..."',
    '  yarn agent:review-thread --pr 123 --thread <thread-id> --reply-file /tmp/reply.txt',
    '  yarn agent:review-thread --pr 123 --thread <index> --reply "..." --dry-run',
    '',
    'Notes:',
    '  For GitHub writes, --thread must be a GraphQL thread node id from --list.',
    '  Numeric indexes are accepted only with --dry-run.',
    '  The command replies to the root review comment in the selected thread, then resolves the thread.',
    '  Use --dry-run to validate selection without writing to GitHub.',
  ].join('\n');
}

function createLogDir() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(
    process.cwd(),
    'node_modules',
    '.cache',
    'agent-review-thread',
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

function commentPreview(comment) {
  const body = comment && comment.body ? comment.body.replace(/\s+/g, ' ') : '';
  return body.length > 120 ? `${body.slice(0, 117)}...` : body;
}

function unresolvedThreads(threads) {
  return threads.filter((thread) => !thread.isResolved);
}

function printThreadList(threads) {
  const unresolved = unresolvedThreads(threads);
  console.log(
    `Review threads: ${unresolved.filter((thread) => !thread.isOutdated).length} active unresolved, ${unresolved.length} total unresolved`,
  );

  unresolved.forEach((thread, index) => {
    const comment = latestComment(thread);
    const root = rootComment(thread);
    const author = comment && comment.author ? comment.author.login : 'unknown';
    const line = thread.line || thread.startLine || '?';
    const flags = thread.isOutdated ? ' outdated' : '';
    console.log(
      `[${index + 1}]${flags} ${thread.path}:${line} @${author} thread=${thread.id} comment=${root ? root.databaseId : 'unknown'} latest=${comment ? comment.databaseId : 'unknown'}`,
    );
    console.log(`    ${commentPreview(comment)}`);
  });
}

function selectThread(threads, selector) {
  const unresolved = unresolvedThreads(threads);
  if (/^\d+$/.test(selector)) {
    const index = Number(selector) - 1;
    if (index >= 0 && index < unresolved.length) {
      return unresolved[index];
    }
  }

  return unresolved.find((thread) => thread.id === selector);
}

function readReply(args) {
  if (args.reply && args.replyFile) {
    throw new Error('Use either --reply or --reply-file, not both.');
  }

  if (args.replyFile) {
    return fs.readFileSync(path.resolve(args.replyFile), 'utf8').trim();
  }

  return args.reply.trim();
}

function replyToThread(logDir, owner, repo, prNumber, commentDatabaseId, body) {
  return runJsonCommand(logDir, 'gh-reply-review-comment', 'gh', [
    'api',
    '--method',
    'POST',
    `repos/${owner}/${repo}/pulls/${prNumber}/comments/${commentDatabaseId}/replies`,
    '-f',
    `body=${body}`,
  ]);
}

function resolveThread(logDir, threadId) {
  const mutation = `
mutation($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread {
      id
      isResolved
    }
  }
}`;

  return runJsonCommand(logDir, 'gh-resolve-review-thread', 'gh', [
    'api',
    'graphql',
    '-f',
    `query=${mutation}`,
    '-f',
    `threadId=${threadId}`,
  ]);
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
    logDir,
    prNumber: '',
    selectedThread: '',
    dryRun: args.dryRun,
  };

  console.log('Agent review thread');
  console.log(`Log dir: ${path.relative(process.cwd(), logDir)}`);

  try {
    const prNumber = detectPrNumber(logDir, args.pr);
    if (!prNumber) {
      throw new Error('No PR found. Pass --pr <number-or-url>.');
    }
    report.prNumber = prNumber;

    const { owner, repo } = detectRepo(logDir);
    const threadResult = fetchReviewThreads({
      logDir,
      owner,
      repo,
      prNumber,
      runJsonCommand,
    });
    if (!threadResult.ok || !threadResult.data) {
      throw new Error(
        `Unable to fetch review threads. See ${path.relative(
          process.cwd(),
          threadResult.logPath,
        )}`,
      );
    }
    const threads = getThreads(threadResult.data);

    if (args.list) {
      printThreadList(threads);
      writeReport(logDir, report);
      return;
    }

    if (!args.thread) {
      throw new Error('Missing --thread. Run with --list first to choose one.');
    }
    if (!args.dryRun && /^\d+$/.test(args.thread)) {
      throw new Error(
        'Use the GraphQL thread id for write operations. Numeric indexes are only allowed with --dry-run.',
      );
    }

    const reply = readReply(args);
    if (!reply) {
      throw new Error('Missing --reply or --reply-file.');
    }

    const thread = selectThread(threads, args.thread);
    if (!thread) {
      throw new Error(
        `Thread "${args.thread}" was not found among unresolved threads.`,
      );
    }

    const comment = latestComment(thread);
    const root = rootComment(thread);
    if (!root || !root.databaseId) {
      throw new Error(
        `Thread "${thread.id}" has no root review comment to reply to.`,
      );
    }

    report.selectedThread = thread.id;
    console.log(
      `Selected: ${thread.path}:${thread.line || thread.startLine || '?'} thread=${thread.id} comment=${root.databaseId} latest=${comment ? comment.databaseId : 'unknown'}`,
    );
    console.log(`Reply preview: ${reply.replace(/\s+/g, ' ').slice(0, 160)}`);

    if (args.dryRun) {
      console.log('DRY RUN: no GitHub write was performed.');
      writeReport(logDir, report);
      return;
    }

    const replyResult = replyToThread(
      logDir,
      owner,
      repo,
      prNumber,
      root.databaseId,
      reply,
    );
    if (!replyResult.ok) {
      throw new Error(
        `Reply failed. See ${path.relative(process.cwd(), replyResult.logPath)}`,
      );
    }

    const resolveResult = resolveThread(logDir, thread.id);
    if (!resolveResult.ok) {
      throw new Error(
        `Resolve failed after reply was posted. See ${path.relative(
          process.cwd(),
          resolveResult.logPath,
        )}`,
      );
    }

    console.log(`Resolved thread: ${thread.id}`);
    writeReport(logDir, report);
  } catch (error) {
    report.error = error.message;
    writeReport(logDir, report);
    console.error(`\nFAIL ${error.message}`);
    process.exit(1);
  }
}

main();
