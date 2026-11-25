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
  /\?\s*[^:?]+\s*:/g,
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
  const records = runGit([
    'diff',
    '-M',
    '--numstat',
    '-z',
    ...rangeArgs,
    '--',
  ]).stdout.split('\0');
  let added = 0;
  let deleted = 0;
  const paths = new Set();
  const trackedNewPaths = new Set();
  const entries = [];

  for (let index = 0; index < records.length - 1; index += 1) {
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
      entries.push({ file: newP, added: a, deleted: d, net: a - d });
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
        const text = fs.readFileSync(f, 'utf8');
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

function stripNonExecutable(lines) {
  const source = lines.join('\n');
  const codeTokens =
    /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'|[`{}]/g;
  const templateTokens = /\\[\s\S]|`|\$\{/g;
  const mask = (text) => text.replace(/[^\n]/g, ' ');
  const frames = [];
  let cursor = 0;
  let code = '';

  // Template text is inert. Its interpolations can contain nested blocks and templates.
  while (cursor < source.length) {
    const inTemplate = frames.at(-1) === 'template';
    const tokens = inTemplate ? templateTokens : codeTokens;
    tokens.lastIndex = cursor;
    const match = tokens.exec(source);
    const between = source.slice(cursor, match?.index);
    code += inTemplate ? mask(between) : between;
    if (!match) break;

    const [token] = match;
    cursor = tokens.lastIndex;
    if (inTemplate) {
      if (token === '`') frames.pop();
      if (token === '${') frames.push('expression');
      code += mask(token);
    } else if (token === '`') {
      frames.push('template');
      code += ' ';
    } else if (token === '{' || token === '}') {
      if (frames.length) {
        if (token === '{') frames.push('expression');
        else frames.pop();
      }
      code += token;
    } else {
      code += mask(token);
    }
  }

  return code.replace(
    /^\s*(?:import\b|export\s+type\b|type\s+\w+\s*=|interface\s+\w+).*$/gm,
    '',
  );
}

function scanPatterns(fromRef, toRef, trackedPaths, untrackedFiles) {
  let netStateFlags = 0;
  let netBranches = 0;
  const scopeCreepWarnings = [];
  const count = (text, res) =>
    res.reduce((s, r) => s + (text.match(r) || []).length, 0);

  const inspectFile = (file, addedLines, removedLines) => {
    const addText = stripNonExecutable(addedLines);
    const remText = stripNonExecutable(removedLines);
    netStateFlags +=
      count(addText, STATE_PATTERNS) - count(remText, STATE_PATTERNS);
    netBranches +=
      count(addText, BRANCH_PATTERNS) - count(remText, BRANCH_PATTERNS);
    for (const re of UI_PATTERNS) {
      const delta =
        (addText.match(re) || []).length - (remText.match(re) || []).length;
      if (delta > 0) {
        scopeCreepWarnings.push({
          file,
          type: 'ui-overlay',
          detail: `Added ${delta} net new UI overlay match(es) (${re.source})`,
        });
      }
    }
    const remKeys = new Set(remText.match(I18N_KEY_RE) || []);
    const newKeys = [...new Set(addText.match(I18N_KEY_RE) || [])].filter(
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

  if (trackedPaths.length) {
    const rangeArgs = toRef ? [fromRef, toRef] : [fromRef];
    const diffOut = runGit([
      '-c',
      'core.quotePath=false',
      '--literal-pathspecs',
      'diff',
      '-M',
      '-U0',
      ...rangeArgs,
      '--',
      ...trackedPaths,
    ]).stdout;
    let curFile = '';
    let inHunk = false;
    let added = [];
    let removed = [];
    const flush = () => {
      if (curFile) inspectFile(curFile, added, removed);
      curFile = '';
      inHunk = false;
      added = [];
      removed = [];
    };
    for (const line of diffOut.split('\n')) {
      if (line.startsWith('diff --git ')) {
        flush();
        const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
        curFile = m ? m[2] : '';
      } else if (line.startsWith('@@ ')) {
        inHunk = true;
      } else if (inHunk && line.startsWith('+')) {
        added.push(line.slice(1));
      } else if (inHunk && line.startsWith('-')) {
        removed.push(line.slice(1));
      }
    }
    flush();
  }

  for (const f of untrackedFiles) {
    inspectFile(f, fs.readFileSync(f, 'utf8').split('\n'), []);
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
  const amplificationRatio =
    origNet > 0 ? Number((fixNet / origNet).toFixed(3)) : null;
  const deletionRatio =
    fixAdded > 0 ? Number((fixDeleted / fixAdded).toFixed(3)) : 1;
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
    amplificationRatio,
    deletionRatio,
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
    .filter(
      ({ file, net, added, deleted }) =>
        reviewFileCounts[file] >= COMPLEXITY_SCORE.hotspotMinThreads &&
        net >= COMPLEXITY_SCORE.hotspotMinNetLines &&
        deleted / added < COMPLEXITY_SCORE.hotspotMinDeletionRatio,
    )
    .map(({ file, net, added, deleted }) => ({
      file,
      net,
      deletionRatio: deleted / added,
      reviewThreads: reviewFileCounts[file],
    }));

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
    const sinceDate = new Date(nowMs - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return {
      mode: 'days',
      days,
      sinceDate,
      search: `created:>=${sinceDate}`,
      limit: 300,
      label: `past ${days}d (since ${sinceDate})`,
    };
  }
  const limit = Math.max(1, Math.min(300, Number(spec) || 30));
  return {
    mode: 'count',
    days: null,
    sinceDate: null,
    search: '',
    limit,
    label: `latest ${limit} PRs`,
  };
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
  const ghArgs = [
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
  ];
  if (query.search) {
    ghArgs.push('--search', query.search);
  }
  ghArgs.push('--json', 'number,title,state,labels');
  const prListRaw = runCmd('gh', ghArgs).stdout;
  const prs = JSON.parse(prListRaw || '[]');
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
      state: pr.state,
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
  const untrackedSet = new Set(fixStats.untrackedFiles);
  const trackedPaths = [...fixStats.paths].filter((p) => !untrackedSet.has(p));
  const { netStateFlags, netBranches, scopeCreepWarnings } = scanPatterns(
    fixBase,
    snap.targetRef,
    trackedPaths,
    fixStats.untrackedFiles,
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
    main();
  } catch (err) {
    console.error(`[check:bloat] Error: ${err.message}`);
    process.exit(1);
  }
}
