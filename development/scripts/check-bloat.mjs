#!/usr/bin/env node
/**
 * Review-Fix Bloat and Scope-Creep Gate.
 *
 * Anchors at the PR's pre-review baseline (--pr auto-detects earliest
 * substantive review of a ready PR, or explicit --since) and evaluates:
 *   1. Fix Amplification & Deletion Ratio (via `git diff -M`, with hard cap)
 *   2. Executable Implicit State-Flag & Branching Growth + UI/i18n Scope-Creep
 *   3. Advisory complexity score and review hotspots
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const THRESHOLDS = {
  minFixNetLines: 120,
  maxAbsoluteFixNetLines: 300,
  maxAmplificationRatio: 0.5,
  minDeletionRatio: 0.25,

  maxNetStateFlags: 4,
};

const COMPLEXITY_SCORE = {
  baseBudget: 120,
  stateFlagCost: 25,
  branchCost: 4,
  hotspotMinThreads: 3,
  hotspotMinNetLines: 60,
  hotspotMinDeletionRatio: 0.4,
};

export const ZERO_BASELINE_RATIO_LABEL = 'N/A (baseline net growth is zero)';

const CODE_FILE_RE = /\.(?:[cm]?[jt]sx?)$/;
const EXCLUDED_PATH_RE =
  /(?:^|\/)(?:__tests__|__mocks__|__snapshots__|node_modules|dist|build|coverage|generated|e2e)\/|\.(?:test|spec|e2e|node-test|generated|stories|d)\.[cm]?[jt]sx?$|translations\.ts$/;
const STATE_PATTERNS = [
  /\buseState(?:<[^>]*>)?\s*\(/g,
  /\buseRef(?:<[^>]*>)?\s*\(/g,
  /\buseReducer(?:<[^>]*>)?\s*\(/g,
  /\blet\s+(?:is|has|should|can|did|pending|skip|lock|retry|count|attempt|inFlight|active|guard)[A-Za-z0-9_]*\b/g,
];
const BRANCH_PATTERNS = [
  /\b(?:if|else\s+if|switch|case|catch)\b/g,
  /\?\s*[^\s:?;][^:?;]*:/g,
];
const UI_PATTERNS = [
  /\bDialog\.show\b/g,
  /\bAlert\.alert\b/g,
  /<(?:Dialog|Modal|Sheet|Popover)\b/g,
];
const I18N_KEY_RE = /\bETranslations\.[A-Za-z0-9_]+\b/g;
const NON_SUBSTANTIVE_REVIEW_BODY_RE =
  /Not posted on this PR by your GitHub settings|<!--\s*(?:onekey-pr-review-bloat-gate|codex-review-receipt:v1)\s*-->|^\s*(?:LGTM|Approved|Looks good)[.!]?\s*$/i;

function parseArgs(argv) {
  const opts = {
    pr: '',
    repo: '',
    base: '',
    head: '',
    since: '',
    benchmark: '',
    worktree: false,
    warnOnly: false,
    strictScope: false,
    json: false,
    help: false,
  };
  const valueFlags = new Set([
    '--pr',
    '--repo',
    '--base',
    '--head',
    '--since',
    '--benchmark',
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--worktree') opts.worktree = true;
    else if (arg === '--warn-only') opts.warnOnly = true;
    else if (arg === '--strict-scope') opts.strictScope = true;
    else if (arg === '--json') opts.json = true;
    else if (valueFlags.has(arg)) {
      i += 1;
      opts[arg.slice(2)] = argv[i] || '';
    } else {
      const eq = arg.indexOf('=');
      const flag = eq > 0 ? arg.slice(0, eq) : '';
      if (valueFlags.has(flag)) opts[flag.slice(2)] = arg.slice(eq + 1);
      else throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

function runCmd(cmd, args, allowFail = false) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (res.status !== 0 && !allowFail) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed: ${(res.stderr || res.stdout || '').trim()}`,
    );
  }
  return res;
}

const runGit = (args, allowFail = false) => runCmd('git', args, allowFail);
const refExists = (ref) =>
  Boolean(ref) &&
  runGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], true)
    .status === 0;
export const isTargetCodeFile = (p) =>
  Boolean(p) && CODE_FILE_RE.test(p) && !EXCLUDED_PATH_RE.test(p);

function ensureCommit(sha) {
  if (!sha) return false;
  if (refExists(sha)) return true;
  runGit(['fetch', 'origin', sha, '--no-tags'], true);
  return refExists(sha);
}

function pickBase(explicit) {
  if (explicit) {
    if (refExists(explicit)) return explicit;
    if (refExists(`origin/${explicit}`)) return `origin/${explicit}`;
    throw new Error(`Base ref not found: ${explicit}`);
  }
  if (refExists('origin/x')) return 'origin/x';
  if (refExists('x')) return 'x';
  return 'HEAD~1';
}

function mergeBase(baseRef, commitRef) {
  return runGit(['merge-base', baseRef, commitRef]).stdout.trim();
}

function resolveRepo(explicit) {
  if (explicit) return explicit;
  const gh = runCmd(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    true,
  );
  if (gh.status === 0 && gh.stdout.trim()) return gh.stdout.trim();
  for (const name of ['upstream', 'origin']) {
    const url = runGit(['remote', 'get-url', name], true).stdout.trim();
    const m = url.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
    if (m) return m[1];
  }
  throw new Error('Unable to resolve GitHub repo; pass --repo owner/name');
}

function fetchGhArray(endpoint) {
  const { stdout } = runCmd('gh', ['api', '--paginate', '--slurp', endpoint]);
  const pages = JSON.parse(stdout);
  if (!Array.isArray(pages)) throw new Error(`Invalid response: ${endpoint}`);
  return pages.flat();
}

export function isSubstantiveReview(review, dismissedState) {
  if (!review?.submitted_at) return false;
  const state =
    review.state === 'DISMISSED' ? dismissedState || 'DISMISSED' : review.state;
  if (
    !['CHANGES_REQUESTED', 'COMMENTED', 'APPROVED', 'DISMISSED'].includes(state)
  ) {
    return false;
  }
  const body = (review.body || '').trim();
  if (!body) return state === 'CHANGES_REQUESTED';
  return !NON_SUBSTANTIVE_REVIEW_BODY_RE.test(body);
}

export function selectEarliestReviewAnchor({
  reviews = [],
  comments = [],
  events = [],
  draft = false,
  prAuthor = '',
}) {
  const transitions = events
    .filter(
      (event) =>
        ['ready_for_review', 'convert_to_draft'].includes(event.event) &&
        Number.isFinite(Date.parse(event.created_at)),
    )
    .toSorted((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const initiallyDraft = transitions.length
    ? transitions[0].event === 'ready_for_review'
    : draft;
  const isReadyAt = (at) => {
    const transition = transitions.findLast(
      (item) => Date.parse(item.created_at) <= Date.parse(at),
    );
    return transition
      ? transition.event === 'ready_for_review'
      : !initiallyDraft;
  };

  const candidates = [];
  const reviewFileCounts = new Map();
  const reviewsById = new Map(reviews.map((review) => [review.id, review]));

  const dismissedStates = new Map(
    events
      .filter(
        (event) => event.event === 'review_dismissed' && event.dismissed_review,
      )
      .map(({ dismissed_review: dismissed }) => [
        String(dismissed.review_id),
        dismissed.state?.toUpperCase(),
      ]),
  );
  for (const review of reviews) {
    if (
      review.user?.login !== prAuthor &&
      isSubstantiveReview(review, dismissedStates.get(String(review.id))) &&
      isReadyAt(review.submitted_at)
    ) {
      candidates.push({
        at: review.submitted_at,
        sha: review.commit_id || '',
        source: `review:${review.user?.login || 'unknown'}`,
      });
    }
  }

  const externalComments = comments
    .filter((comment) => comment.created_at && comment.user?.login !== prAuthor)
    .map((comment) => {
      const review = reviewsById.get(comment.pull_request_review_id);
      const at =
        Date.parse(review?.submitted_at) > Date.parse(comment.created_at)
          ? review.submitted_at
          : comment.created_at;
      return { comment, review, at };
    })
    .filter(({ at }) => isReadyAt(at))
    .toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const countedThreads = new Set();
  for (const { comment, review, at } of externalComments) {
    // Replies refer to the root. The first external comment in a ready period
    // can anchor a thread the author started, without counting later replies.
    const threadId = comment.in_reply_to_id || comment.id;
    if (!countedThreads.has(threadId)) {
      countedThreads.add(threadId);
      if (isTargetCodeFile(comment.path)) {
        reviewFileCounts.set(
          comment.path,
          (reviewFileCounts.get(comment.path) || 0) + 1,
        );
      }
      candidates.push({
        at,
        // A root comment's current commit_id moves as the PR advances.
        sha: comment.in_reply_to_id
          ? review?.commit_id || ''
          : comment.original_commit_id || review?.commit_id || '',
        source: `comment:${comment.user?.login || 'unknown'}`,
      });
    }
  }

  const sorted = candidates.toSorted(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  return {
    earliest: sorted[0] || null,
    reviewFileCounts: Object.fromEntries(reviewFileCounts),
    totalReviewComments: candidates.length,
  };
}

function fetchReviewState(repo, pr, prMeta) {
  return selectEarliestReviewAnchor({
    reviews: fetchGhArray(`repos/${repo}/pulls/${pr}/reviews`),
    comments: fetchGhArray(`repos/${repo}/pulls/${pr}/comments`),
    events: fetchGhArray(`repos/${repo}/issues/${pr}/events`),
    draft: prMeta.draft,
    prAuthor: prMeta.user?.login || '',
  });
}

function resolveSnapshots(opts) {
  if (opts.since) {
    if (!refExists(opts.since))
      throw new Error(`--since not found: ${opts.since}`);
    const baseRef = pickBase(opts.base);
    const preReviewSha = runGit(['rev-parse', opts.since]).stdout.trim();
    return {
      outcome: 'EVALUATE',
      skipped: false,
      mode: 'since',
      baseRef,
      preReviewSha,
      targetRef: null,
      origBase: mergeBase(baseRef, preReviewSha),
      currentBase: mergeBase(baseRef, 'HEAD'),
      baselineSource: `since:${opts.since}`,
      reviewFileCounts: {},
      totalReviewComments: 0,
    };
  }
  if (!opts.pr) {
    return {
      outcome: 'NO_BASELINE',
      skipped: true,
      skipReason: 'no_baseline_specified',
      mode: 'none',
    };
  }

  const repo = resolveRepo(opts.repo);
  const prMeta = JSON.parse(
    runCmd('gh', ['api', `repos/${repo}/pulls/${opts.pr}`]).stdout,
  );
  const remoteBase = prMeta.base?.ref ? `origin/${prMeta.base.ref}` : '';
  const baseRef = pickBase(
    opts.base || (refExists(remoteBase) ? remoteBase : prMeta.base?.ref || ''),
  );
  const headSha = opts.head || prMeta.head?.sha || '';
  if (!opts.worktree && !ensureCommit(headSha)) {
    throw new Error(`PR head commit not available: ${headSha}`);
  }
  const targetRef = opts.worktree
    ? null
    : runGit(['rev-parse', headSha]).stdout.trim();
  const currentBase = mergeBase(baseRef, targetRef || 'HEAD');

  const { earliest, reviewFileCounts, totalReviewComments } = fetchReviewState(
    repo,
    opts.pr,
    prMeta,
  );
  if (!earliest) {
    return {
      outcome: 'NO_REVIEWS',
      skipped: true,
      skipReason: 'no_reviews_yet',
      mode: 'pr',
      baseRef,
    };
  }

  const baselineSource = `${earliest.source}@${earliest.at}`;
  if (!ensureCommit(earliest.sha)) {
    return incompleteReport(
      { mode: 'pr', baseRef, baselineSource },
      'review_commit_unreachable',
    );
  }
  const preReviewSha = runGit(['rev-parse', earliest.sha]).stdout.trim();

  return {
    outcome: 'EVALUATE',
    skipped: false,
    mode: 'pr',
    baseRef,
    preReviewSha,
    targetRef,
    origBase: mergeBase(baseRef, preReviewSha),
    currentBase,
    baselineSource,
    reviewFileCounts,
    totalReviewComments,
  };
}

function incompleteReport(snapshot, reason) {
  return {
    ...snapshot,
    verdict: 'INCOMPLETE',
    outcome: 'INCOMPLETE',
    skipped: true,
    skipReason: reason,
  };
}

function collectDiffStats(fromRef, toRef, { includeUntracked = false } = {}) {
  const rangeArgs = toRef ? [fromRef, toRef] : [fromRef];
  const out = runGit([
    'diff',
    '-M',
    '--numstat',
    '-z',
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    ...rangeArgs,
    '--',
  ]).stdout;
  const records = out.split('\0');
  if (records.at(-1) === '') records.pop();
  let added = 0;
  let deleted = 0;
  const paths = new Set();
  const trackedNewPaths = new Set();
  const entries = [];

  for (let index = 0; index < records.length; index += 1) {
    const [, aStr, dStr, rawPath] = /^(\S+)\t(\S+)\t([\s\S]*)$/.exec(
      records[index],
    );
    const [oldP, newP] = rawPath
      ? [rawPath, rawPath]
      : [records[index + 1], records[index + 2]];
    if (!rawPath) index += 2;
    if (
      aStr !== '-' &&
      dStr !== '-' &&
      (isTargetCodeFile(oldP) || isTargetCodeFile(newP))
    ) {
      const a = Number(aStr);
      const d = Number(dStr);
      added += a;
      deleted += d;
      paths.add(oldP);
      paths.add(newP);
      trackedNewPaths.add(newP);
      entries.push({
        file: newP,
        ...(oldP !== newP ? { previousFile: oldP } : {}),
        added: a,
        deleted: d,
        net: a - d,
      });
    }
  }

  const untrackedFiles = [];
  if (includeUntracked) {
    const ls = runGit([
      'ls-files',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
    ]).stdout;
    for (const f of ls.split('\0').filter(Boolean)) {
      if (isTargetCodeFile(f) && !trackedNewPaths.has(f) && fs.existsSync(f)) {
        const text = readWorktreeSource(f);
        const lines = text ? text.replace(/\n$/, '').split('\n').length : 0;
        added += lines;
        paths.add(f);
        untrackedFiles.push(f);
        entries.push({ file: f, added: lines, deleted: 0, net: lines });
      }
    }
  }

  return {
    added,
    deleted,
    net: added - deleted,
    paths,
    untrackedFiles,
    entries,
    fileCount: entries.length,
    hotspots: entries.toSorted((a, b) => b.net - a.net).slice(0, 5),
  };
}

function alignReviewTree({ origBase, currentBase, preReviewSha }) {
  if (origBase === currentBase) return { tree: preReviewSha, conflicts: [] };
  // Compare two trees on the same base without touching the index or worktree.
  const result = runGit(
    [
      'merge-tree',
      '--write-tree',
      '--name-only',
      '-z',
      currentBase,
      preReviewSha,
    ],
    true,
  );
  const [tree, ...conflicts] = result.stdout
    .split('\0\0', 1)[0]
    .split('\0')
    .filter(Boolean);
  if (
    result.status === 1 &&
    (!conflicts.length || conflicts.some(isTargetCodeFile))
  ) {
    return { tree: null, conflicts };
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Unable to align review tree: ${result.stderr.trim()}`);
  }
  return { tree, conflicts };
}

const mask = (text) => text.replace(/[^\n]/g, ' ');
const maskLiteral = (text) => `0${mask(text.slice(1))}`;
const require = createRequire(import.meta.url);
const OXC_SCAN_OPTION = '--internal-oxc-scan';

function hasOxcParser() {
  try {
    require.resolve('oxc-parser/package.json');
    return true;
  } catch (error) {
    // Reruns of older workflows copy the checker without its dependencies.
    if (error.code === 'MODULE_NOT_FOUND') return false;
    throw error;
  }
}

function stripNonExecutable(source, file, oxcParser) {
  if (!oxcParser) return stripUnparsedSource(source, file);

  let sourceType = 'unambiguous';
  if (/\.m[jt]s$/.test(file)) sourceType = 'module';
  else if (/\.c[jt]s$/.test(file)) sourceType = 'commonjs';

  const isTypeScript = /\.[cm]?tsx?$/.test(file);
  const spans = [];
  try {
    const { program, comments, errors } = oxcParser.parseSync(file, source, {
      sourceType,
      lang: isTypeScript ? undefined : 'jsx',
      preserveParens: false,
    });
    if (errors.length) return stripUnparsedSource(source, file);

    for (const comment of comments) {
      spans.push({ start: comment.start, end: comment.end, literal: false });
    }
    new oxcParser.Visitor({
      Literal(node) {
        if (typeof node.value === 'string' || node.regex) {
          spans.push({ start: node.start, end: node.end, literal: true });
        }
      },
      JSXText(node) {
        spans.push({ start: node.start, end: node.end, literal: false });
      },
      TemplateLiteral(node) {
        // cspell:ignore quasis
        for (const [index, part] of node.quasis.entries()) {
          // Oxc includes delimiters in quasi ranges. Keep interpolation code.
          spans.push({
            start: index === 0 ? part.start : part.start + 1,
            end: part.tail ? part.end : part.end - 2,
            literal: index === 0,
          });
        }
      },
    }).visit(program);
  } catch (error) {
    const stackOverflow =
      error instanceof RangeError &&
      error.message === 'Maximum call stack size exceeded';
    if (!(error instanceof SyntaxError) && !stackOverflow) throw error;
    return stripUnparsedSource(source, file);
  }

  const parts = [];
  let cursor = 0;
  for (const { start, end, literal } of spans.toSorted(
    (a, b) => a.start - b.start,
  )) {
    const text = source.slice(start, end);
    parts.push(
      source.slice(cursor, start),
      literal ? maskLiteral(text) : mask(text),
    );
    cursor = end;
  }
  parts.push(source.slice(cursor));
  return stripDeclarationLines(parts.join(''));
}

function stripDeclarationLines(source) {
  return source.replace(
    /^[ \t]*(?:import\b|export\s+type\b|type\s+\w+\s*=|interface\s+\w+).*$/gm,
    mask,
  );
}

function stripUnparsedSource(source, file) {
  const codeTokens =
    /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'|[/`{}]/g;
  const regexpLiteral =
    /\/(?![/*])(?:\\[^\n]|\[(?:\\[^\n]|[^\]\\\n])*\]|[^/\\[\n])+\/([dgimsuvy]*)/y;
  const regexpOperator = /(?:^|[=(,:!;?{[]|=>|&&|\|\||\.\.\.)$/;
  const regexpKeyword = /[\p{ID_Continue}$]+$/u;
  const expressionKeywords = new Set(['return', 'throw', 'case']);
  const contextualKeywords = new Set(['yield', 'await']);
  const regexpTerminator = /\s*(?:\.(?!\d)|[),;:}\]?]|$)/y;
  const explicitModule = /\.m[jt]s$/.test(file);
  const templateTokens = /\\[\s\S]|\x60|\$\{/g;
  const frames = [];
  const code = [];
  let cursor = 0;
  let context = '';

  const append = (text) => {
    code.push(text);
    const normalized = text.replace(/\s+/g, ' ');
    // Preserve enough recent tokens to distinguish a spread from member access.
    const tail =
      context.endsWith(' ') && normalized.startsWith(' ')
        ? normalized.slice(1)
        : normalized;
    context = (context + tail).slice(-16);
  };

  const readRegexp = (offset) => {
    const prefix = context.trimEnd();
    const word = regexpKeyword.exec(prefix);
    const beforeWord = word ? prefix.slice(0, word.index).trimEnd() : '';
    const standalone =
      word && (!beforeWord.endsWith('.') || beforeWord.endsWith('...'));
    const afterKeyword = standalone && expressionKeywords.has(word[0]);
    const afterContextual = standalone && contextualKeywords.has(word[0]);
    if (
      !(
        afterKeyword ||
        afterContextual ||
        regexpOperator.test(prefix.slice(-3))
      )
    ) {
      return null;
    }
    regexpLiteral.lastIndex = offset;
    const literal = regexpLiteral.exec(source);
    if (literal && afterContextual && !explicitModule) {
      // In scripts, an unflagged regex followed by a delimiter cannot be division.
      regexpTerminator.lastIndex = regexpLiteral.lastIndex;
      if (literal[1] || !regexpTerminator.test(source)) return null;
    }
    return literal;
  };

  // Template text is inert. Its interpolations can contain nested blocks and templates.
  while (cursor < source.length) {
    const inTemplate = frames.at(-1) === 'template';
    const tokens = inTemplate ? templateTokens : codeTokens;
    tokens.lastIndex = cursor;
    const match = tokens.exec(source);
    const between = source.slice(cursor, match?.index);
    append(inTemplate ? mask(between) : between);
    if (!match) break;

    const [token] = match;
    cursor = tokens.lastIndex;
    if (inTemplate) {
      if (token === '`') frames.pop();
      if (token === '${') frames.push('expression');
      append(token === '${' ? ' {' : mask(token));
    } else if (token === '`') {
      frames.push('template');
      append('0');
    } else if (token === '{' || token === '}') {
      if (frames.length) {
        if (token === '{') frames.push('expression');
        else frames.pop();
      }
      append(token);
    } else if (token === '/') {
      const literal = readRegexp(match.index);
      if (literal) {
        append(maskLiteral(literal[0]));
        cursor = regexpLiteral.lastIndex;
      } else {
        append(token);
      }
    } else {
      append(token.startsWith('/') ? mask(token) : maskLiteral(token));
    }
  }

  return stripDeclarationLines(code.join(''));
}

function readWorktreeSource(file) {
  return fs.lstatSync(file).isSymbolicLink()
    ? fs.readlinkSync(file)
    : fs.readFileSync(file, 'utf8');
}

function exactFileSelector(file) {
  // A glob containing an escape matches the whole path, without matching its descendants.
  return `:(top,glob)${file.replace(/^.|[\\*?[\]]/gsu, (character) => `\\${character}`)}`;
}

function scanPatterns(fromRef, toRef, { entries, untrackedFiles }) {
  const files = { entries, untrackedFiles };
  if (hasOxcParser()) {
    // Native stack overflow can terminate Node before JavaScript can catch it.
    const env = { ...process.env };
    delete env.GH_TOKEN;
    delete env.GITHUB_TOKEN;
    const worker = spawnSync(
      process.execPath,
      [process.argv[1], OXC_SCAN_OPTION],
      {
        env,
        input: JSON.stringify({ fromRef, toRef, files }),
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    if (worker.error) throw worker.error;
    if (worker.status === 0) return JSON.parse(worker.stdout);
    if (!['SIGSEGV', 'SIGABRT', 'SIGBUS'].includes(worker.signal)) {
      throw new Error(
        worker.stderr.trim() || 'Oxc scanner failed to produce a report',
      );
    }
    console.warn(
      '[check:bloat] Native parser process stopped; retrying with the fallback scanner.',
    );
  }
  return scanFilePatterns(fromRef, toRef, files);
}

function scanFilePatterns(
  fromRef,
  toRef,
  { entries, untrackedFiles },
  oxcParser,
) {
  let netStateFlags = 0;
  let netBranches = 0;
  const scopeCreepWarnings = [];
  const matches = (chunks, pattern) =>
    chunks.flatMap((chunk) => chunk.match(pattern) || []);
  const count = (chunks, patterns) =>
    patterns.reduce((sum, pattern) => sum + matches(chunks, pattern).length, 0);

  const countBranches = (chunks) =>
    count(
      chunks.map((chunk) => chunk.replace(/\?\?|\?\./g, '  ')),
      BRANCH_PATTERNS,
    );

  const inspectFile = (file, added, removed) => {
    netStateFlags +=
      count(added, STATE_PATTERNS) - count(removed, STATE_PATTERNS);
    netBranches += countBranches(added) - countBranches(removed);
    for (const re of UI_PATTERNS) {
      const delta = matches(added, re).length - matches(removed, re).length;
      if (delta > 0) {
        scopeCreepWarnings.push({
          file,
          type: 'ui-overlay',
          detail: `Added ${delta} net new UI overlay match(es) (${re.source})`,
        });
      }
    }
    const remKeys = new Set(matches(removed, I18N_KEY_RE));
    const newKeys = [...new Set(matches(added, I18N_KEY_RE))].filter(
      (k) => !remKeys.has(k),
    );
    if (newKeys.length) {
      scopeCreepWarnings.push({
        file,
        type: 'i18n-copy',
        detail: `Introduced ${newKeys.length} new i18n key(s): ${newKeys.slice(0, 5).join(', ')}`,
      });
    }
  };

  const selectChangedText = (ranges, file, readSource) => {
    const changed = ranges.filter(([, length]) => length > 0);
    if (!changed.length) return [];
    // Lex the complete source before selecting zero-context ranges from the patch.
    const source = stripNonExecutable(readSource(), file, oxcParser).split(
      '\n',
    );
    return changed.map(([start, length]) =>
      source.slice(start - 1, start - 1 + length).join('\n'),
    );
  };

  const untracked = new Set(untrackedFiles);
  const rangeArgs = toRef ? [fromRef, toRef] : [fromRef];
  for (const {
    file,
    previousFile,
    added: linesAdded,
    deleted: linesDeleted,
  } of entries.filter(
    (entry) => !untracked.has(entry.file) && (entry.added || entry.deleted),
  )) {
    const oldPath = previousFile || file;
    const patch = runGit([
      '--no-literal-pathspecs',
      'diff',
      '-M',
      '-U0',
      '--inter-hunk-context=0',
      '--no-ext-diff',
      '--no-textconv',
      '--no-color',
      ...rangeArgs,
      '--',
      ...(previousFile ? [previousFile, file] : [file]).map(exactFileSelector),
    ]).stdout;
    const before = [];
    const after = [];
    // A file type change can produce separate deletion and addition sections.
    for (const [, oldStart, oldCount, newStart, newCount] of patch.matchAll(
      /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm,
    )) {
      // A deleted path can become a directory with unrelated added descendants.
      if (linesDeleted) before.push([Number(oldStart), Number(oldCount ?? 1)]);
      if (linesAdded) after.push([Number(newStart), Number(newCount ?? 1)]);
    }
    const added = selectChangedText(after, file, () =>
      toRef
        ? runGit(['show', `${toRef}:${file}`]).stdout
        : readWorktreeSource(file),
    );
    const removed = selectChangedText(
      before,
      oldPath,
      () => runGit(['show', `${fromRef}:${oldPath}`]).stdout,
    );
    inspectFile(file, added, removed);
  }
  for (const file of untrackedFiles) {
    inspectFile(
      file,
      [stripNonExecutable(readWorktreeSource(file), file, oxcParser)],
      [],
    );
  }
  return { netStateFlags, netBranches, scopeCreepWarnings };
}

export function evaluateAmplification({
  origNet: rawOrigNet,
  fixAdded,
  fixDeleted,
  fixNet,
  thresholds = THRESHOLDS,
}) {
  const origNet = Math.max(0, rawOrigNet);
  const amplificationRatio = origNet > 0 ? fixNet / origNet : null;
  const deletionRatio = fixAdded > 0 ? fixDeleted / fixAdded : 1;
  const hardCapLimit = thresholds.maxAbsoluteFixNetLines ?? Infinity;
  const hardCapReached = fixNet >= hardCapLimit;
  const meetsGrowthRule =
    amplificationRatio === null
      ? true
      : amplificationRatio >= thresholds.maxAmplificationRatio ||
        hardCapReached;
  const triggered =
    fixNet >= thresholds.minFixNetLines &&
    meetsGrowthRule &&
    deletionRatio < thresholds.minDeletionRatio;

  return {
    origNet,
    fixAdded,
    fixDeleted,
    fixNet,
    amplificationRatio:
      amplificationRatio === null
        ? null
        : Number(amplificationRatio.toFixed(3)),
    deletionRatio: Number(deletionRatio.toFixed(3)),
    hardCapReached,
    triggered,
  };
}

export function evaluateComplexityScore({
  fixAdded,
  fixDeleted,
  fixNet,
  netStateFlags,
  netBranches,
  reviewFileCounts,
  fileEntries,
}) {
  const { baseBudget, stateFlagCost, branchCost } = COMPLEXITY_SCORE;
  const lineCredit =
    fixAdded === 0 || fixDeleted / fixAdded >= THRESHOLDS.minDeletionRatio
      ? Math.floor(fixDeleted * 0.5)
      : 0;
  const changeCost =
    fixNet + netStateFlags * stateFlagCost + netBranches * branchCost;
  const hotspots = fileEntries
    .filter(({ net }) => net >= COMPLEXITY_SCORE.hotspotMinNetLines)
    .map(({ file, previousFile, net, added, deleted }) => ({
      file,
      net,
      deletionRatio: deleted / added,
      // Each review thread is assigned one path, even when it has replies.
      reviewThreads:
        (reviewFileCounts[file] || 0) + (reviewFileCounts[previousFile] || 0),
    }))
    .filter(
      ({ reviewThreads, deletionRatio }) =>
        reviewThreads >= COMPLEXITY_SCORE.hotspotMinThreads &&
        deletionRatio < COMPLEXITY_SCORE.hotspotMinDeletionRatio,
    );

  return {
    score: baseBudget + lineCredit - changeCost,
    baseBudget,
    lineCredit,
    changeCost,
    hotspots,
  };
}

export function formatAmplificationRatio(amplificationRatio) {
  if (amplificationRatio === null || amplificationRatio === undefined) {
    return ZERO_BASELINE_RATIO_LABEL;
  }
  return `${(amplificationRatio * 100).toFixed(0)}%`;
}

export function formatCliAmplificationLine(amp) {
  const netLabel = `${amp.fixNet >= 0 ? '+' : ''}${amp.fixNet}`;
  const ratioLabel = formatAmplificationRatio(amp.amplificationRatio);
  const delLabel = `${(amp.deletionRatio * 100).toFixed(0)}%`;
  const status = amp.triggered ? 'FAIL' : 'OK';
  return `  1. Fix Amplification: +${amp.fixAdded}/-${amp.fixDeleted} (net ${netLabel}) vs orig +${amp.origNet} | ratio=${ratioLabel} | del/add=${delLabel} [${status}]`;
}

export function summarizeBenchmarkResults(items = []) {
  const evaluated = items.filter((item) => !item.skipped && item.amplification);
  const enforced = evaluated.filter((item) => !item.bypassed);
  const passed = enforced.filter((item) => item.verdict === 'PASS');
  const flagged = enforced.filter(
    (item) => item.verdict === 'REFACTOR_REQUIRED',
  );
  const bypassed = items.filter((item) => item.bypassed);
  const incomplete = items.filter((item) => item.outcome === 'INCOMPLETE');
  const errors = items.filter((item) => item.outcome === 'ERROR');
  const advisory = evaluated.filter((item) =>
    Number.isFinite(item.complexity?.score),
  );

  return {
    totalPrs: items.length,
    evaluatedCount: evaluated.length,
    nonBypassedEvaluatedCount: enforced.length,
    passedCount: passed.length,
    refactorRequiredCount: flagged.length,
    bypassedCount: bypassed.length,
    incompleteCount: incomplete.length,
    errorCount: errors.length,
    otherSkippedCount:
      items.length - evaluated.length - incomplete.length - errors.length,
    interventionRate: enforced.length ? flagged.length / enforced.length : null,
    bypassedSimulations: evaluated
      .filter((item) => item.bypassed)
      .map(({ number, verdict }) => ({ number, verdict })),
    advisoryCount: advisory.length,
    negativeScoreCount: advisory.filter((item) => item.complexity.score < 0)
      .length,
    passedPrs: passed.map((item) => ({
      number: item.number,
      score: item.complexity?.score ?? null,
    })),
    flaggedPrs: flagged.map((p) => ({
      number: p.number,
      title: p.title,
      origNet: p.amplification?.origNet ?? 0,
      fixNet: p.amplification?.fixNet ?? 0,
      deletionRatio: p.amplification?.deletionRatio ?? 0,
      netStateFlags: p.stateFlags?.netStateFlags ?? 0,
      score: p.complexity?.score ?? null,
    })),
    incompletePrs: incomplete.map(({ number, skipReason }) => ({
      number,
      reason: skipReason,
    })),
    errorPrs: errors.map(({ number, error }) => ({ number, error })),
  };
}

export function resolveBenchmarkQuery(rawSpec = '7d', nowMs = Date.now()) {
  const spec = String(rawSpec || '7d')
    .trim()
    .toLowerCase();
  const dayMatch = spec.match(/^(\d+)\s*d(?:ays?)?$/);
  if (spec === 'week' || spec === '7d' || dayMatch) {
    const days = dayMatch ? Math.max(1, Math.min(90, Number(dayMatch[1]))) : 7;
    const sinceMs = nowMs - days * 86_400_000;
    return {
      mode: 'days',
      days,
      sinceMs,
      nowMs,
      label: `past ${days}d (since ${new Date(sinceMs).toISOString()})`,
    };
  }
  const limit = Math.max(1, Math.min(300, Math.trunc(Number(spec)) || 30));
  return {
    mode: 'count',
    limit,
    label: `latest ${limit} PRs`,
  };
}

const BENCHMARK_PAGE_SIZE = 100;

export function collectBenchmarkWindow({ sinceMs, nowMs }, fetchPage) {
  const prs = new Map();
  for (let page = 1; ; page += 1) {
    const candidates = fetchPage(page);
    for (const pr of candidates) {
      const created = Date.parse(pr.created_at);
      if (created < sinceMs) return [...prs.values()];
      if (created <= nowMs) prs.set(pr.number, pr);
    }
    if (candidates.length < BENCHMARK_PAGE_SIZE) return [...prs.values()];
  }
}

function runBenchmarkMode(opts) {
  const query = resolveBenchmarkQuery(opts.benchmark);
  const repo = resolveRepo(opts.repo);
  const base = 'x';
  const baseSha = runCmd('gh', [
    'api',
    `repos/${repo}/git/ref/heads/${base}`,
    '--jq',
    '.object.sha',
  ]).stdout.trim();
  if (!ensureCommit(baseSha)) {
    throw new Error(`Benchmark base commit not available: ${repo}@${baseSha}`);
  }
  const prs =
    query.mode === 'days'
      ? collectBenchmarkWindow(query, (page) =>
          JSON.parse(
            runCmd('gh', [
              'api',
              `repos/${repo}/pulls?state=all&base=${base}&sort=created&direction=desc&per_page=${BENCHMARK_PAGE_SIZE}&page=${page}`,
              '--jq',
              '[.[] | {number,title,labels,created_at}]',
            ]).stdout,
          ),
        )
      : JSON.parse(
          runCmd('gh', [
            'pr',
            'list',
            '--repo',
            repo,
            '--state',
            'all',
            '--base',
            base,
            '--limit',
            String(query.limit),
            '--json',
            'number,title,labels',
          ]).stdout,
        );
  const results = [];

  for (const pr of prs) {
    const bypassed = (pr.labels || []).some(
      (l) => l?.name === 'bloat-reviewed',
    );
    const res = runCmd(
      process.execPath,
      [
        process.argv[1],
        '--pr',
        String(pr.number),
        '--repo',
        repo,
        '--base',
        baseSha,
        '--json',
        '--warn-only',
      ],
      true,
    );
    let parsed;
    try {
      if (res.status !== 0) throw new Error(res.stderr.trim());
      parsed = JSON.parse(res.stdout);
    } catch (error) {
      parsed = {
        skipped: true,
        outcome: 'ERROR',
        error: error.message || `Analysis exited with status ${res.status}`,
      };
    }
    results.push({
      number: pr.number,
      title: pr.title,
      bypassed,
      ...parsed,
    });
  }

  const summary = {
    window: query.label,
    base,
    baseSha,
    ...summarizeBenchmarkResults(results),
  };
  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `[check:bloat] Benchmark across ${query.label} — ${summary.totalPrs} PRs (${repo}:${base}@${baseSha.slice(0, 10)}):`,
    );
    const rate =
      summary.interventionRate === null
        ? 'N/A'
        : `${(summary.interventionRate * 100).toFixed(0)}%`;
    console.log(
      `  Evaluated: ${summary.evaluatedCount} | Evaluated without bypass: ${summary.nonBypassedEvaluatedCount} | PASS: ${summary.passedCount} | REFACTOR_REQUIRED: ${summary.refactorRequiredCount} (${rate}) | Currently labeled bloat-reviewed: ${summary.bypassedCount}`,
    );
    console.log(
      `  Incomplete: ${summary.incompleteCount} | Errors: ${summary.errorCount} | Other skips: ${summary.otherSkippedCount} | Negative advisory scores: ${summary.negativeScoreCount}/${summary.advisoryCount}`,
    );
    for (const item of [...summary.incompletePrs, ...summary.errorPrs]) {
      console.log(`  - #${item.number}: ${item.reason || item.error}`);
    }
    for (const item of summary.bypassedSimulations) {
      console.log(
        `  - #${item.number}: ${item.verdict} without the current bypass label`,
      );
    }
    for (const item of summary.passedPrs) {
      console.log(`  - #${item.number}: PASS, score=${item.score ?? 'N/A'}`);
    }
    for (const f of summary.flaggedPrs) {
      console.log(
        `  - #${f.number}: fixNet=${f.fixNet} (orig +${f.origNet}), del/add=${(f.deletionRatio * 100).toFixed(0)}%, flags=${f.netStateFlags}, score=${f.score ?? 'N/A'} | ${f.title}`,
      );
    }
  }
}

function printSkipped(snapshot, json) {
  const report = { verdict: 'PASS', ...snapshot };
  console.log(
    json
      ? JSON.stringify(report, null, 2)
      : `[check:bloat] ${report.outcome} (${report.skipReason}) — VERDICT: ${report.verdict}`,
  );
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      'Usage: node development/scripts/check-bloat.mjs [--pr N] [--repo o/r] [--base ref] [--head sha] [--since ref] [--benchmark 7d|N] [--worktree] [--warn-only] [--strict-scope] [--json]',
    );
    process.exit(0);
  }
  if (opts.pr || opts.since || opts.benchmark) {
    process.chdir(
      runGit(['rev-parse', '--show-toplevel']).stdout.replace(/\n$/, ''),
    );
  }
  if (opts.benchmark) {
    runBenchmarkMode(opts);
    process.exit(0);
  }

  const snap = resolveSnapshots(opts);
  if (snap.skipped) {
    printSkipped(snap, opts.json);
    return;
  }

  const { tree: fixBase, conflicts } = alignReviewTree(snap);
  const fixStats =
    fixBase &&
    collectDiffStats(fixBase, snap.targetRef, {
      includeUntracked: snap.targetRef === null,
    });
  // An excluded conflict can still matter if the fix renamed it into a code path.
  if (!fixStats || conflicts.some((file) => fixStats.paths.has(file))) {
    printSkipped(
      incompleteReport(snap, 'review_tree_conflicts_with_current_base'),
      opts.json,
    );
    return;
  }
  const origStats = collectDiffStats(snap.origBase, snap.preReviewSha);
  if (!fixStats.fileCount) {
    printSkipped(
      {
        ...snap,
        outcome: 'NO_CODE_CHANGES',
        skipped: true,
        skipReason: 'no_code_changes_since_review',
      },
      opts.json,
    );
    return;
  }

  const amp = evaluateAmplification({
    origNet: origStats.net,
    fixAdded: fixStats.added,
    fixDeleted: fixStats.deleted,
    fixNet: fixStats.net,
  });
  const { netStateFlags, netBranches, scopeCreepWarnings } = scanPatterns(
    fixBase,
    snap.targetRef,
    fixStats,
  );
  const stateTriggered = netStateFlags >= THRESHOLDS.maxNetStateFlags;
  const complexity = evaluateComplexityScore({
    fixAdded: fixStats.added,
    fixDeleted: fixStats.deleted,
    fixNet: fixStats.net,
    netStateFlags,
    netBranches,
    reviewFileCounts: snap.reviewFileCounts,
    fileEntries: fixStats.entries,
  });
  const failed =
    amp.triggered ||
    stateTriggered ||
    (opts.strictScope && scopeCreepWarnings.length > 0);

  const report = {
    ...snap,
    verdict: failed ? 'REFACTOR_REQUIRED' : 'PASS',
    outcome: failed ? 'REFACTOR_REQUIRED' : 'PASS',
    skipped: false,
    thresholds: THRESHOLDS,
    filesChecked: fixStats.fileCount,
    amplification: {
      ...amp,
      hotspots: fixStats.hotspots,
    },
    stateFlags: { netStateFlags, netBranches, triggered: stateTriggered },
    complexity,
    scopeCreepWarnings,
  };

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `[check:bloat] mode=${report.mode} baseline=${report.preReviewSha.slice(0, 10)} (${report.baselineSource}) files=${report.filesChecked}`,
    );
    console.log(formatCliAmplificationLine(amp));
    console.log(
      `  2. Implicit State Flags: ${netStateFlags >= 0 ? '+' : ''}${netStateFlags} (limit < ${THRESHOLDS.maxNetStateFlags}, branches ${netBranches >= 0 ? '+' : ''}${netBranches}) [${stateTriggered ? 'FAIL' : 'OK'}]`,
    );
    console.log(
      `  3. Advisory complexity: ${complexity.score} (budget=${complexity.baseBudget}, deletion credit=${complexity.lineCredit}, change cost=${complexity.changeCost})`,
    );
    for (const w of scopeCreepWarnings) {
      console.log(`  [SCOPE_CREEP_WARN] ${w.file} [${w.type}]: ${w.detail}`);
    }
    console.log(`VERDICT: ${report.verdict}`);
  }

  if (failed && !opts.warnOnly) process.exit(2);
}

const isEntrypoint =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  try {
    if (process.argv[2] === OXC_SCAN_OPTION) {
      const { fromRef, toRef, files } = JSON.parse(fs.readFileSync(0, 'utf8'));
      const oxcParser = require('oxc-parser');
      console.log(
        JSON.stringify(scanFilePatterns(fromRef, toRef, files, oxcParser)),
      );
    } else {
      main();
    }
  } catch (err) {
    console.error(`[check:bloat] Error: ${err.message}`);
    process.exit(1);
  }
}
