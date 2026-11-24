#!/usr/bin/env node
/**
 * Review-Fix Bloat & Scope-Creep Gate.
 *
 * Anchors at the PR's pre-review baseline (--pr auto-detects earliest review
 * commit, or explicit --since) and checks two cheat-resistant metrics:
 *   1. Fix Amplification & Deletion Ratio (via `git diff -M --numstat`)
 *   2. Executable Implicit State-Flag Growth + UI/i18n Scope-Creep Warnings
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const THRESHOLDS = {
  minFixNetLines: 120,
  maxAmplificationRatio: 0.5,
  minDeletionRatio: 0.25,
  maxNetStateFlags: 4,
};

const CODE_FILE_RE = /\.(?:[cm]?[jt]sx?)$/;
const EXCLUDED_PATH_RE =
  /(?:^|\/)(?:__tests__|__mocks__|__snapshots__|node_modules|dist|build|coverage)\/|\.(?:test|spec|stories|d)\.[cm]?[jt]sx?$|translations\.ts$/;
const STATE_PATTERNS = [
  /\buseState(?:<[^>]*>)?\s*\(/g,
  /\buseRef(?:<[^>]*>)?\s*\(/g,
  /\buseReducer(?:<[^>]*>)?\s*\(/g,
  /\blet\s+(?:is|has|should|can|did|pending|skip|lock|retry|count|attempt)[A-Za-z0-9_]*\b/g,
];
const UI_PATTERNS = [
  /\bDialog\.show\b/g,
  /\bAlert\.alert\b/g,
  /<(?:Dialog|Modal|Sheet|Popover)\b/g,
];
const I18N_KEY_RE = /\bETranslations\.[A-Za-z0-9_]+\b/g;

function parseArgs(argv) {
  const opts = {
    pr: '',
    repo: '',
    base: '',
    head: '',
    since: '',
    worktree: false,
    warnOnly: false,
    strictScope: false,
    json: false,
    help: false,
  };
  const valueFlags = new Set(['--pr', '--repo', '--base', '--head', '--since']);
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
const isTargetCodeFile = (p) =>
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

function fetchGhArray(endpoint) {
  const out = runCmd('gh', ['api', '--paginate', '--slurp', endpoint]).stdout;
  if (!out.trim()) return [];
  const pages = JSON.parse(out);
  if (!Array.isArray(pages)) throw new Error(`Invalid response: ${endpoint}`);
  return pages.flat();
}

function fetchEarliestReview(repo, pr) {
  const reviews = fetchGhArray(`repos/${repo}/pulls/${pr}/reviews`);
  const comments = fetchGhArray(`repos/${repo}/pulls/${pr}/comments`);
  const list = [];
  for (const r of reviews) {
    const hasFeedback =
      (r.body && r.body.trim()) ||
      r.state === 'CHANGES_REQUESTED' ||
      r.state === 'COMMENTED';
    if (hasFeedback && r.submitted_at) {
      list.push({
        at: r.submitted_at,
        sha: r.commit_id || '',
        source: `review:${r.user?.login || 'unknown'}`,
      });
    }
  }
  for (const c of comments) {
    if (c.created_at) {
      list.push({
        at: c.created_at,
        sha: c.original_commit_id || c.commit_id || '',
        source: `comment:${c.user?.login || 'unknown'}`,
      });
    }
  }
  return (
    list.toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at))[0] || null
  );
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

  const earliest = fetchEarliestReview(repo, opts.pr);
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
    preReviewSha = runGit(
      [
        'log',
        `--before=${earliest.at}`,
        '-n',
        '1',
        '--format=%H',
        `${currentBase}..${targetRef || 'HEAD'}`,
      ],
      true,
    ).stdout.trim();
    if (preReviewSha) baselineSource += ' (timestamp-fallback)';
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
        !paths.has(f) &&
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
  const scopeCreepWarnings = [];
  const count = (text, res) =>
    res.reduce((s, r) => s + (text.match(r) || []).length, 0);

  const inspectFile = (file, addedLines, removedLines) => {
    const addText = stripNonExecutable(addedLines);
    const remText = stripNonExecutable(removedLines);
    netStateFlags +=
      count(addText, STATE_PATTERNS) - count(remText, STATE_PATTERNS);
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
  return { netStateFlags, scopeCreepWarnings };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      'Usage: node development/scripts/check-bloat.mjs [--pr N] [--repo o/r] [--base ref] [--head sha] [--since ref] [--worktree] [--warn-only] [--strict-scope] [--json]',
    );
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
  const fixStats = collectDiffStats(snap.preReviewSha, snap.targetRef, {
    includeUntracked,
    onlyPaths: baseAdvanced ? prPaths : null,
  });

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

  const origNet = Math.max(0, origStats.net);
  const fixNet = baseAdvanced ? currStats.net - origStats.net : fixStats.net;
  let amplificationRatio = 0;
  if (origNet > 0) amplificationRatio = Number((fixNet / origNet).toFixed(3));
  else if (fixNet > 0) amplificationRatio = 999;
  const deletionRatio =
    fixStats.added > 0
      ? Number((fixStats.deleted / fixStats.added).toFixed(3))
      : 1;
  const ampTriggered =
    fixNet >= THRESHOLDS.minFixNetLines &&
    amplificationRatio >= THRESHOLDS.maxAmplificationRatio &&
    deletionRatio < THRESHOLDS.minDeletionRatio;

  const untrackedSet = new Set(fixStats.untrackedFiles);
  const trackedPaths = [...fixStats.paths]
    .filter((p) => !untrackedSet.has(p))
    .toSorted();
  const { netStateFlags, scopeCreepWarnings } = scanPatterns(
    snap.preReviewSha,
    snap.targetRef,
    trackedPaths,
    fixStats.untrackedFiles,
  );
  const stateTriggered = netStateFlags >= THRESHOLDS.maxNetStateFlags;
  const failed =
    ampTriggered ||
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
      origNet,
      fixAdded: fixStats.added,
      fixDeleted: fixStats.deleted,
      fixNet,
      amplificationRatio,
      deletionRatio,
      hotspots: fixStats.hotspots,
      triggered: ampTriggered,
    },
    stateFlags: { netStateFlags, triggered: stateTriggered },
    scopeCreepWarnings,
  };

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `[check:bloat] mode=${report.mode} baseline=${report.preReviewSha.slice(0, 10)} (${report.baselineSource}) files=${report.filesChecked}`,
    );
    console.log(
      `  1. Fix Amplification: +${fixStats.added}/-${fixStats.deleted} (net ${fixNet >= 0 ? '+' : ''}${fixNet}) vs orig +${origNet} | ratio=${(amplificationRatio * 100).toFixed(0)}% | del/add=${(deletionRatio * 100).toFixed(0)}% [${ampTriggered ? 'FAIL' : 'OK'}]`,
    );
    console.log(
      `  2. Implicit State Flags: ${netStateFlags >= 0 ? '+' : ''}${netStateFlags} (limit < ${THRESHOLDS.maxNetStateFlags}) [${stateTriggered ? 'FAIL' : 'OK'}]`,
    );
    for (const w of scopeCreepWarnings) {
      console.log(`  [SCOPE_CREEP_WARN] ${w.file} [${w.type}]: ${w.detail}`);
    }
    console.log(`VERDICT: ${report.verdict}`);
  }

  if (failed && !opts.warnOnly) process.exit(2);
}

try {
  main();
} catch (err) {
  console.error(`[check:bloat] Error: ${err.message}`);
  process.exit(1);
}
