#!/usr/bin/env node
/**
 * Review-Fix Bloat, Scope-Creep & Nash Equilibrium Gate.
 *
 * Anchors at the PR's pre-review baseline (--pr auto-detects earliest
 * substantive post-draft review commit, or explicit --since) and evaluates:
 *   1. Fix Amplification & Deletion Ratio (via `git diff -M`, with hard cap)
 *   2. Executable Implicit State-Flag & Branching Growth + UI/i18n Scope-Creep
 *   3. Nash Equilibrium Utility (Payoff = Complexity Budget + Refactor Credit - Entropy Cost)
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const THRESHOLDS = {
  minFixNetLines: 120,
  maxAbsoluteFixNetLines: 300,
  maxAmplificationRatio: 0.5,
  minDeletionRatio: 0.25,
  clusterMinDeletionRatio: 0.4,
  maxNetStateFlags: 4,
  stateFlagCostWeight: 25,
  branchCostWeight: 4,
  clusterPenaltyWeight: 40,
  baseComplexityBudget: 120,
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
  /Not posted on this PR by your GitHub settings|<!--\s*onekey-pr-review-bloat-gate\s*-->|^\s*(?:LGTM!?|Approved\.?)\s*$/i;

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
  const res = runGit(['merge-base', baseRef, commitRef], true);
  return res.status === 0
    ? res.stdout.trim()
    : runGit(['rev-parse', baseRef]).stdout.trim();
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

function fetchGhArray(endpoint, allowFail = false) {
  const res = runCmd(
    'gh',
    ['api', '--paginate', '--slurp', endpoint],
    allowFail,
  );
  if (res.status !== 0 || !res.stdout.trim()) return [];
  const pages = JSON.parse(res.stdout);
  if (!Array.isArray(pages)) throw new Error(`Invalid response: ${endpoint}`);
  return pages.flat();
}

export function isSubstantiveReview(review) {
  if (!review || !review.submitted_at) return false;
  const state = review.state || '';
  if (state !== 'CHANGES_REQUESTED' && state !== 'COMMENTED') return false;
  const body = (review.body || '').trim();
  if (state === 'COMMENTED' && !body) {
    // Empty COMMENTED reviews are envelopes for inline comments, which are
    // tracked individually with file/line metadata via pulls/{pr}/comments.
    return false;
  }
  if (body && NON_SUBSTANTIVE_REVIEW_BODY_RE.test(body)) {
    return false;
  }
  return true;
}

export function selectEarliestReviewAnchor({
  reviews = [],
  comments = [],
  readyForReviewAt = null,
  prAuthor = '',
}) {
  const readyMs = readyForReviewAt ? Date.parse(readyForReviewAt) : null;
  const candidates = [];
  const reviewFileCounts = {};

  for (const r of reviews) {
    if (isSubstantiveReview(r) && (!prAuthor || r.user?.login !== prAuthor)) {
      candidates.push({
        at: r.submitted_at,
        sha: r.commit_id || '',
        source: `review:${r.user?.login || 'unknown'}`,
        isBot: r.user?.type === 'Bot',
      });
    }
  }

  for (const c of comments) {
    // Exclude thread replies (e.g. author "Fixed in <sha>" responses) and
    // self-comments by the PR author so replies do not inflate per-file cluster counts.
    const isReply = Boolean(c?.in_reply_to_id);
    const isSelf = Boolean(prAuthor && c?.user?.login === prAuthor);
    if (c && c.created_at && !isReply && !isSelf) {
      if (c.path && isTargetCodeFile(c.path)) {
        reviewFileCounts[c.path] = (reviewFileCounts[c.path] || 0) + 1;
      }
      candidates.push({
        at: c.created_at,
        sha: c.original_commit_id || c.commit_id || '',
        source: `comment:${c.user?.login || 'unknown'}`,
        isBot: c.user?.type === 'Bot',
        path: c.path || '',
      });
    }
  }

  const sorted = candidates.toSorted(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  if (!sorted.length) {
    return { earliest: null, reviewFileCounts, totalReviewComments: 0 };
  }

  // Prefer the earliest review at or after ready_for_review so early bot comments
  // on WIP drafts do not prematurely lock the baseline on commit #1.
  const postDraft =
    readyMs && !Number.isNaN(readyMs)
      ? sorted.filter((item) => Date.parse(item.at) >= readyMs)
      : [];
  const earliest = postDraft[0] || sorted[0];

  return {
    earliest,
    reviewFileCounts,
    totalReviewComments: candidates.length,
  };
}

export function findPreReviewCommitFromLog(logOutput, earliestAt) {
  const cutoffMs = Date.parse(earliestAt);
  if (Number.isNaN(cutoffMs) || !logOutput.trim()) return '';

  // Expected format per line: "<sha>\t<authorIso>\t<committerIso>" ordered newest-first.
  // Checking authorDate makes the lookup resilient to `git rebase`, which
  // overwrites committerDate to the rebase timestamp while preserving authorDate.
  for (const line of logOutput.split('\n').filter(Boolean)) {
    const [sha, authorIso, committerIso] = line.split('\t');
    const authorMs = authorIso ? Date.parse(authorIso) : NaN;
    const committerMs = committerIso ? Date.parse(committerIso) : NaN;
    if (
      (!Number.isNaN(committerMs) && committerMs <= cutoffMs) ||
      (!Number.isNaN(authorMs) && authorMs <= cutoffMs)
    ) {
      return sha.trim();
    }
  }
  return '';
}

function fetchReadyForReviewTimestamp(repo, pr) {
  const events = fetchGhArray(`repos/${repo}/issues/${pr}/events`, true);
  let latestReadyAt = null;
  for (const ev of events) {
    if (ev?.event === 'ready_for_review' && ev.created_at) {
      if (
        !latestReadyAt ||
        Date.parse(ev.created_at) > Date.parse(latestReadyAt)
      ) {
        latestReadyAt = ev.created_at;
      }
    }
  }
  return latestReadyAt;
}

function fetchReviewState(repo, pr, prAuthor = '') {
  const reviews = fetchGhArray(`repos/${repo}/pulls/${pr}/reviews`);
  const comments = fetchGhArray(`repos/${repo}/pulls/${pr}/comments`);
  const readyForReviewAt = fetchReadyForReviewTimestamp(repo, pr);
  return selectEarliestReviewAnchor({
    reviews,
    comments,
    readyForReviewAt,
    prAuthor,
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
    prMeta.user?.login || '',
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

  let preReviewSha = '';
  let baselineSource = `${earliest.source}@${earliest.at}`;
  if (ensureCommit(earliest.sha)) {
    preReviewSha = runGit(['rev-parse', earliest.sha]).stdout.trim();
  } else {
    const logOut = runGit(
      [
        'log',
        '--format=%H%x09%aI%x09%cI',
        `${currentBase}..${targetRef || 'HEAD'}`,
      ],
      true,
    ).stdout;
    preReviewSha = findPreReviewCommitFromLog(logOut, earliest.at);
    if (preReviewSha) baselineSource += ' (author-timestamp-fallback)';
  }

  if (!preReviewSha) {
    return {
      outcome: 'INCOMPLETE',
      skipped: true,
      skipReason: 'baseline_unreachable_after_rebase',
      mode: 'pr',
      baseRef,
      baselineSource,
    };
  }

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

function expandRenamePath(rawPath) {
  const brace = rawPath.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (brace)
    return [
      `${brace[1]}${brace[2]}${brace[4]}`,
      `${brace[1]}${brace[3]}${brace[4]}`,
    ];
  const arrow = rawPath.split(' => ');
  return arrow.length === 2 ? [arrow[0], arrow[1]] : [rawPath, rawPath];
}

function collectDiffStats(
  fromRef,
  toRef,
  { includeUntracked = false, onlyPaths = null } = {},
) {
  const rangeArgs = toRef ? [fromRef, toRef] : [fromRef];
  const out = runGit(['diff', '-M', '--numstat', ...rangeArgs, '--']).stdout;
  let added = 0;
  let deleted = 0;
  const paths = new Set();
  const trackedNewPaths = new Set();
  const entries = [];

  for (const line of out.split('\n').filter(Boolean)) {
    const [aStr, dStr, rawPath] = line.split('\t');
    if (rawPath && aStr !== '-' && dStr !== '-') {
      const [oldP, newP] = expandRenamePath(rawPath);
      const inScope =
        (isTargetCodeFile(oldP) || isTargetCodeFile(newP)) &&
        (!onlyPaths || onlyPaths.has(oldP) || onlyPaths.has(newP));
      if (inScope) {
        const a = Number(aStr);
        const d = Number(dStr);
        added += a;
        deleted += d;
        paths.add(oldP);
        paths.add(newP);
        if (newP) trackedNewPaths.add(newP);
        entries.push({ file: newP || oldP, added: a, deleted: d, net: a - d });
      }
    }
  }

  const untrackedFiles = [];
  if (includeUntracked) {
    const ls = runGit([
      'ls-files',
      '--others',
      '--exclude-standard',
      '--',
    ]).stdout;
    for (const f of ls
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (
        isTargetCodeFile(f) &&
        !trackedNewPaths.has(f) &&
        (!onlyPaths || onlyPaths.has(f)) &&
        fs.existsSync(f)
      ) {
        const lines = fs.readFileSync(f, 'utf8').split('\n').length;
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

/**
 * Eliminates upstream base-branch pollution when a PR merges or rebases onto a
 * newer base branch during review (`origBase !== currentBase`).
 * For files untouched by upstream between `origBase..currentBase`, the direct
 * `preReviewSha..targetRef` diff is exact. For files also modified by upstream,
 * we compute the PR-isolated delta from `currStats` vs `origStats`.
 */
export function reconcileBaseAdvancedStats(
  origStats,
  currStats,
  rawFixStats,
  upstreamChangedPaths = new Set(),
) {
  if (!upstreamChangedPaths || upstreamChangedPaths.size === 0) {
    return rawFixStats;
  }

  const origByFile = new Map((origStats.entries || []).map((e) => [e.file, e]));
  const currByFile = new Map((currStats.entries || []).map((e) => [e.file, e]));
  const rawByFile = new Map(
    (rawFixStats.entries || []).map((e) => [e.file, e]),
  );

  const allFiles = new Set([
    ...origByFile.keys(),
    ...currByFile.keys(),
    ...rawByFile.keys(),
  ]);

  let added = 0;
  let deleted = 0;
  const entries = [];
  const paths = new Set();

  for (const file of allFiles) {
    if (!upstreamChangedPaths.has(file)) {
      const raw = rawByFile.get(file);
      if (raw && (raw.added > 0 || raw.deleted > 0)) {
        added += raw.added;
        deleted += raw.deleted;
        paths.add(file);
        entries.push(raw);
      }
    } else {
      const orig = origByFile.get(file) || { added: 0, deleted: 0, net: 0 };
      const curr = currByFile.get(file) || { added: 0, deleted: 0, net: 0 };
      const netDelta = curr.net - orig.net;
      let fileAdded = Math.max(0, curr.added - orig.added);
      let fileDeleted = Math.max(0, curr.deleted - orig.deleted);
      // Ensure fileAdded - fileDeleted === netDelta
      const diff = netDelta - (fileAdded - fileDeleted);
      if (diff > 0) fileAdded += diff;
      else if (diff < 0) fileDeleted += -diff;

      if (fileAdded > 0 || fileDeleted > 0) {
        added += fileAdded;
        deleted += fileDeleted;
        paths.add(file);
        entries.push({
          file,
          added: fileAdded,
          deleted: fileDeleted,
          net: netDelta,
        });
      }
    }
  }

  return {
    added,
    deleted,
    net: added - deleted,
    paths,
    untrackedFiles: rawFixStats.untrackedFiles || [],
    entries,
    fileCount: entries.length,
    hotspots: entries.toSorted((a, b) => b.net - a.net).slice(0, 5),
  };
}

function stripNonExecutable(lines) {
  const kept = [];
  let inBlock = false;
  for (const raw of lines) {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end === -1) line = '';
      else {
        line = line.slice(end + 2);
        inBlock = false;
      }
    }
    line = line.replace(/\/\*[\s\S]*?\*\//g, '');
    const start = line.indexOf('/*');
    if (start !== -1) {
      line = line.slice(0, start);
      inBlock = true;
    }
    const clean = line.replace(/\/\/.*$/, '').trim();
    if (
      clean &&
      !/^(?:import\b|export\s+type\b|type\s+\w+\s*=|interface\s+\w+)/.test(
        clean,
      )
    ) {
      kept.push(clean);
    }
  }
  return kept.join('\n');
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

/**
 * Evaluates the Reviewer-Fixer Nash Equilibrium payoff:
 *   NetPayoff (U) = ComplexityBudget (B) + RefactorCredit (R) - EntropyCost (C)
 *
 * Game-theoretic design:
 *   - Diminishing budget per file: the 1st and 2nd review comments on a file
 *     grant +20 / +10 ECU budget; the 3rd+ comment on the SAME file grants +0
 *     budget and flags the file as a cluster requiring >= 40% deletion ratio.
 *   - High tax on implicit state flags (+25 ECU each) and branching (+4 ECU each).
 *   - Positive refactor credit for deleting legacy lines (when deletionRatio >= 25%)
 *     or eliminating state flags/branches, making convergent refactoring the
 *     strictly dominant strategy over symptom-by-symptom patching.
 */
export function evaluateEquilibrium({
  origNet: rawOrigNet = 0,
  fixAdded = 0,
  fixDeleted = 0,
  fixNet = fixAdded - fixDeleted,
  netStateFlags = 0,
  netBranches = 0,
  reviewFileCounts = {},
  fileEntries = [],
  thresholds = THRESHOLDS,
}) {
  const origNet = Math.max(0, rawOrigNet);
  const deletionRatio =
    fixAdded > 0 ? Number((fixDeleted / fixAdded).toFixed(3)) : 1;

  // 1. Complexity Budget (B) with per-file diminishing marginal allowance
  const baseBudget = thresholds.baseComplexityBudget ?? 120;
  const scaleBonus =
    origNet > 0
      ? Math.min(60, Math.floor(Math.max(0, origNet - 240) * 0.25))
      : 0;
  let reviewBonus = 0;
  const clusteredFiles = [];
  const entryMap = new Map((fileEntries || []).map((e) => [e.file, e]));

  for (const [file, count] of Object.entries(reviewFileCounts || {})) {
    if (count >= 1) reviewBonus += 20;
    if (count >= 2) reviewBonus += 10;
    // 3rd+ comment on the same file grants 0 extra budget (anti-spin)
    if (count >= 3) {
      const entry = entryMap.get(file);
      const fileDelRatio =
        entry && entry.added > 0 ? entry.deleted / entry.added : 1;
      if (
        entry &&
        entry.net >= 60 &&
        fileDelRatio < (thresholds.clusterMinDeletionRatio ?? 0.4)
      ) {
        clusteredFiles.push(file);
      }
    }
  }
  reviewBonus = Math.min(60, reviewBonus);
  const hardCap = thresholds.maxAbsoluteFixNetLines ?? 300;
  const complexityBudget = Math.min(
    hardCap,
    baseBudget + scaleBonus + reviewBonus,
  );

  // 2. Entropy Cost (C)
  const lineGrowthCost = Math.max(0, fixNet);
  const stateFlagCost =
    Math.max(0, netStateFlags) * (thresholds.stateFlagCostWeight ?? 25);
  const branchCost =
    Math.max(0, netBranches) * (thresholds.branchCostWeight ?? 4);
  const clusterPenalty =
    clusteredFiles.length * (thresholds.clusterPenaltyWeight ?? 40);
  const entropyCost =
    lineGrowthCost + stateFlagCost + branchCost + clusterPenalty;

  // 3. Refactor Credit (R)
  const lineRefactorCredit =
    deletionRatio >= thresholds.minDeletionRatio
      ? Math.floor(fixDeleted * 0.5)
      : 0;
  const stateReductionCredit =
    Math.max(0, -netStateFlags) * (thresholds.stateFlagCostWeight ?? 25);
  const branchReductionCredit =
    Math.max(0, -netBranches) * (thresholds.branchCostWeight ?? 4);
  const refactorCredit =
    lineRefactorCredit + stateReductionCredit + branchReductionCredit;

  // 4. Net Payoff (U) & Equilibrium Verdict
  const netPayoff = complexityBudget + refactorCredit - entropyCost;
  const hasMultiDimBloat =
    netStateFlags >= 2 ||
    clusteredFiles.length > 0 ||
    fixNet >= thresholds.minFixNetLines;
  const triggered =
    netPayoff < 0 &&
    deletionRatio < thresholds.minDeletionRatio &&
    hasMultiDimBloat;

  let dominantStrategy = 'CONVERGED_LOCAL_FIX';
  if (triggered || netPayoff < 0) {
    dominantStrategy =
      clusteredFiles.length > 0 ||
      netStateFlags >= 3 ||
      deletionRatio < thresholds.minDeletionRatio
        ? 'CONVERGENT_REFACTOR'
        : 'PRUNE_DEFENSIVE_PATCHES';
  }

  return {
    complexityBudget,
    entropyCost,
    refactorCredit,
    netPayoff,
    netBranches,
    clusteredFiles,
    dominantStrategy,
    triggered,
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

export function formatCliEquilibriumLine(eq) {
  const payoffLabel = `${eq.netPayoff >= 0 ? '+' : ''}${eq.netPayoff}`;
  const status = eq.triggered ? 'FAIL' : 'OK';
  return `  3. Nash Equilibrium Payoff: ${payoffLabel} ECU (budget=${eq.complexityBudget} + credit=${eq.refactorCredit} - cost=${eq.entropyCost}) | strategy=${eq.dominantStrategy} [${status}]`;
}

export function summarizeBenchmarkResults(items = []) {
  const evaluated = items.filter((item) => !item.skipped && item.amplification);
  const passed = evaluated.filter((item) => item.verdict === 'PASS');
  const flagged = evaluated.filter(
    (item) => item.verdict === 'REFACTOR_REQUIRED',
  );
  const bypassed = items.filter((item) => item.bypassed);
  const falsePositiveCandidates = flagged.filter(
    (item) => item.bypassed || (item.amplification?.deletionRatio ?? 0) >= 0.22,
  );
  const borderlineSpinCandidates = passed.filter(
    (item) =>
      (item.amplification?.fixNet ?? 0) >= 90 &&
      (item.amplification?.deletionRatio ?? 1) < 0.25,
  );

  const interventionRate =
    evaluated.length > 0
      ? Number((flagged.length / evaluated.length).toFixed(3))
      : 0;
  const recommendations = [];
  if (falsePositiveCandidates.length > 0) {
    recommendations.push(
      `Inspect ${falsePositiveCandidates.length} potential false-positive PR(s) (${falsePositiveCandidates.map((p) => `#${p.number}`).join(', ')}): consider lowering minDeletionRatio from 0.25 to 0.22 if genuine refactors were flagged.`,
    );
  }
  if (interventionRate > 0.3) {
    recommendations.push(
      `Intervention rate is ${(interventionRate * 100).toFixed(0)}% (> 30% target band): consider raising baseComplexityBudget from ${THRESHOLDS.baseComplexityBudget} to ${THRESHOLDS.baseComplexityBudget + 30}.`,
    );
  }
  if (borderlineSpinCandidates.length >= 2) {
    recommendations.push(
      `Found ${borderlineSpinCandidates.length} sub-cliff low-deletion PR(s) (${borderlineSpinCandidates.map((p) => `#${p.number}`).join(', ')}): consider raising stateFlagCostWeight from ${THRESHOLDS.stateFlagCostWeight} to 35.`,
    );
  }
  if (!recommendations.length) {
    recommendations.push(
      'CALIBRATED: intervention rate is within the 10%-25% target band with 0 false-positive overrides.',
    );
  }

  return {
    totalPrs: items.length,
    evaluatedCount: evaluated.length,
    passedCount: passed.length,
    refactorRequiredCount: flagged.length,
    bypassedCount: bypassed.length,
    interventionRate,
    flaggedPrs: flagged.map((p) => ({
      number: p.number,
      title: p.title,
      origNet: p.amplification?.origNet ?? 0,
      fixNet: p.amplification?.fixNet ?? 0,
      deletionRatio: p.amplification?.deletionRatio ?? 0,
      netStateFlags: p.stateFlags?.netStateFlags ?? 0,
      netPayoff: p.equilibrium?.netPayoff ?? 0,
    })),
    falsePositiveCandidates: falsePositiveCandidates.map((p) => p.number),
    borderlineSpinCandidates: borderlineSpinCandidates.map((p) => p.number),
    recommendations,
  };
}

function runBenchmarkMode(opts) {
  const limit = Math.max(1, Math.min(100, Number(opts.benchmark) || 30));
  const repo = resolveRepo(opts.repo);
  const prListRaw = runCmd('gh', [
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--limit',
    String(limit),
    '--json',
    'number,title,state,labels',
  ]).stdout;
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
        '--json',
        '--warn-only',
      ],
      true,
    );
    let parsed = { skipped: true, outcome: 'ERROR', verdict: 'PASS' };
    try {
      parsed = JSON.parse(res.stdout);
    } catch {
      // Keep fallback on transient error
    }
    results.push({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      bypassed,
      ...parsed,
    });
  }

  const summary = summarizeBenchmarkResults(results);
  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `[check:bloat] Benchmark across latest ${summary.totalPrs} PRs (${repo}):`,
    );
    console.log(
      `  Evaluated: ${summary.evaluatedCount} | PASS: ${summary.passedCount} | REFACTOR_REQUIRED: ${summary.refactorRequiredCount} (${(summary.interventionRate * 100).toFixed(0)}%) | Bypassed (bloat-reviewed): ${summary.bypassedCount}`,
    );
    for (const f of summary.flaggedPrs) {
      console.log(
        `  - #${f.number}: fixNet=+${f.fixNet} (orig +${f.origNet}), del/add=${(f.deletionRatio * 100).toFixed(0)}%, flags=+${f.netStateFlags}, payoff=${f.netPayoff} | ${f.title}`,
      );
    }
    for (const rec of summary.recommendations) {
      console.log(`  [CALIBRATION] ${rec}`);
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      'Usage: node development/scripts/check-bloat.mjs [--pr N] [--repo o/r] [--base ref] [--head sha] [--since ref] [--benchmark N] [--worktree] [--warn-only] [--strict-scope] [--json]',
    );
    process.exit(0);
  }
  if (opts.benchmark) {
    runBenchmarkMode(opts);
    process.exit(0);
  }

  const snap = resolveSnapshots(opts);
  if (snap.skipped) {
    const out = { ...snap, verdict: 'PASS' };
    console.log(
      opts.json
        ? JSON.stringify(out, null, 2)
        : `[check:bloat] ${out.outcome} (${out.skipReason}) — VERDICT: PASS`,
    );
    process.exit(0);
  }

  const includeUntracked = snap.targetRef === null;
  const origStats = collectDiffStats(snap.origBase, snap.preReviewSha);
  const currStats = collectDiffStats(snap.currentBase, snap.targetRef, {
    includeUntracked,
  });
  const prPaths = new Set([...origStats.paths, ...currStats.paths]);
  const baseAdvanced = snap.origBase !== snap.currentBase;
  const rawFixStats = collectDiffStats(snap.preReviewSha, snap.targetRef, {
    includeUntracked,
    onlyPaths: baseAdvanced ? prPaths : null,
  });

  let upstreamChangedPaths = new Set();
  if (baseAdvanced) {
    const upstreamOut = runGit(
      ['diff', '--name-only', snap.origBase, snap.currentBase, '--'],
      true,
    ).stdout;
    upstreamChangedPaths = new Set(
      upstreamOut
        .split('\n')
        .map((s) => s.trim())
        .filter((f) => f && prPaths.has(f)),
    );
  }

  const fixStats = baseAdvanced
    ? reconcileBaseAdvancedStats(
        origStats,
        currStats,
        rawFixStats,
        upstreamChangedPaths,
      )
    : rawFixStats;

  if (!fixStats.fileCount) {
    const out = {
      ...snap,
      verdict: 'PASS',
      outcome: 'NO_CODE_CHANGES',
      skipped: true,
      skipReason: 'no_code_changes_since_review',
    };
    console.log(
      opts.json
        ? JSON.stringify(out, null, 2)
        : `[check:bloat] NO_CODE_CHANGES — VERDICT: PASS`,
    );
    process.exit(0);
  }

  const fixNet = baseAdvanced ? currStats.net - origStats.net : fixStats.net;
  const amp = evaluateAmplification({
    origNet: origStats.net,
    fixAdded: fixStats.added,
    fixDeleted: fixStats.deleted,
    fixNet,
  });

  const untrackedSet = new Set(fixStats.untrackedFiles);
  const trackedPaths = [...fixStats.paths]
    .filter((p) => !untrackedSet.has(p) && !upstreamChangedPaths.has(p))
    .toSorted();
  const { netStateFlags, netBranches, scopeCreepWarnings } = scanPatterns(
    snap.preReviewSha,
    snap.targetRef,
    trackedPaths,
    fixStats.untrackedFiles,
  );
  const stateTriggered = netStateFlags >= THRESHOLDS.maxNetStateFlags;
  const equilibrium = evaluateEquilibrium({
    origNet: origStats.net,
    fixAdded: fixStats.added,
    fixDeleted: fixStats.deleted,
    fixNet,
    netStateFlags,
    netBranches,
    reviewFileCounts: snap.reviewFileCounts,
    fileEntries: fixStats.entries,
  });
  const failed =
    amp.triggered ||
    stateTriggered ||
    equilibrium.triggered ||
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
    equilibrium,
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
    console.log(formatCliEquilibriumLine(equilibrium));
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
