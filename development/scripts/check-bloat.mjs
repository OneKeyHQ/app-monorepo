#!/usr/bin/env node
/**
 * Review-Fix Bloat & Refactor Gate.
 *
 * Layered architecture:
 *   1. Snapshot Resolver: resolves (origBase, preReviewSha, currentBase, targetRef)
 *      immune to target-branch advances and accidental cross-branch worktree diffs.
 *   2. Unified ChangeSet: single `git diff -M` (preserving renames & deletions)
 *      merged with local untracked files when inspecting a worktree.
 *   3. Metrics: Fix Amplification + Deletion Ratio, Self-Churn (oldCount > 0 only),
 *      Executable State-Flag Growth & Nesting Ratchet, and Scope-Creep Warnings.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const THRESHOLDS = {
  minFixNetLines: 120,
  maxAmplificationRatio: 0.5,
  minDeletionRatio: 0.25,
  minSelfChurnLines: 40,
  maxSelfChurnRatio: 0.35,
  maxNetStateFlags: 4,
  maxDepth: 5,
  maxNestedCallbacks: 5,
};

const CODE_FILE_RE = /\.(?:[cm]?[jt]sx?)$/;
const EXCLUDED_PATH_RE =
  /(?:^|\/)(?:__tests__|__mocks__|__snapshots__|node_modules|dist|build|coverage)\/|\.(?:test|spec|stories|d)\.[cm]?[jt]sx?$|translations\.ts$/;

const STATE_FLAG_PATTERNS = [
  /\buseState(?:<[^>]*>)?\s*\(/g,
  /\buseRef(?:<[^>]*>)?\s*\(/g,
  /\buseReducer(?:<[^>]*>)?\s*\(/g,
  /\blet\s+(?:is|has|should|can|did|pending|skip|lock|retry|count|attempt)[A-Za-z0-9_]*\b/g,
];
const UI_OVERLAY_PATTERNS = [
  /\bDialog\.show\b/g,
  /\bAlert\.alert\b/g,
  /<(?:Dialog|Modal|Sheet|Popover)\b/g,
];
const I18N_KEY_RE = /\bETranslations\.[A-Za-z0-9_]+\b/g;

function printHelp() {
  console.log(
    [
      'Usage: node development/scripts/check-bloat.mjs [options]',
      '  --pr <number>    Auto-detect pre-review baseline & head from PR via gh CLI',
      '  --repo <o/r>     GitHub repo (owner/name) for --pr',
      '  --base <ref>     PR base branch/ref (default: PR base, origin/x, or x)',
      '  --head <ref>     Explicit target commit SHA for --pr mode',
      '  --since <ref>    Explicit pre-review baseline SHA/ref (compares against worktree)',
      '  --worktree       With --pr, compare against local worktree instead of PR head',
      '  --oxlint <path>  Path to oxlint binary (or set OXLINT_BIN)',
      '  --warn-only      Report without failing (exit 0)',
      '  --strict-scope   Treat scope-creep warnings as hard failures (exit 2)',
      '  --json           Output JSON',
      'Exit codes: 0=PASS/SKIP/INCOMPLETE, 2=REFACTOR_REQUIRED, 1=error',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const opts = {
    pr: '',
    repo: '',
    base: '',
    head: '',
    since: '',
    worktree: false,
    oxlint: process.env.OXLINT_BIN || '',
    warnOnly: false,
    strictScope: false,
    json: false,
    help: false,
  };
  const valueFlags = new Map([
    ['--pr', 'pr'],
    ['--repo', 'repo'],
    ['--base', 'base'],
    ['--head', 'head'],
    ['--since', 'since'],
    ['--oxlint', 'oxlint'],
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--warn-only') opts.warnOnly = true;
    else if (arg === '--strict-scope') opts.strictScope = true;
    else if (arg === '--worktree') opts.worktree = true;
    else if (arg === '--json') opts.json = true;
    else if (valueFlags.has(arg)) {
      i += 1;
      opts[valueFlags.get(arg)] = argv[i] || '';
    } else {
      const eq = arg.indexOf('=');
      const flag = eq > 0 ? arg.slice(0, eq) : '';
      if (valueFlags.has(flag)) {
        opts[valueFlags.get(flag)] = arg.slice(eq + 1);
      } else {
        throw new Error(`Unknown option: ${arg}`);
      }
    }
  }
  return opts;
}

function runCmd(cmd, args, { cwd, allowFail = false } = {}) {
  const useShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(cmd);
  const res = spawnSync(cmd, args, {
    cwd,
    shell: useShell,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  if (res.status !== 0 && !allowFail) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed: ${(res.stderr || res.stdout || '').trim()}`,
    );
  }
  return res;
}

const runGit = (args, allowFail = false) => runCmd('git', args, { allowFail });

const refExists = (ref) =>
  Boolean(ref) &&
  runGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], true)
    .status === 0;

function isTargetCodeFile(filePath) {
  return (
    Boolean(filePath) &&
    CODE_FILE_RE.test(filePath) &&
    !EXCLUDED_PATH_RE.test(filePath)
  );
}

function pickDefaultBase(explicitBase) {
  if (explicitBase) {
    if (refExists(explicitBase)) return explicitBase;
    if (refExists(`origin/${explicitBase}`)) return `origin/${explicitBase}`;
    throw new Error(`Base ref not found: ${explicitBase}`);
  }
  if (refExists('origin/x')) return 'origin/x';
  if (refExists('x')) return 'x';
  return 'HEAD~1';
}

function resolveRepoSlug(explicitRepo) {
  if (explicitRepo) return explicitRepo;
  const ghOut = runCmd(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    { allowFail: true },
  );
  if (ghOut.status === 0 && ghOut.stdout.trim()) return ghOut.stdout.trim();
  for (const remoteName of ['upstream', 'origin']) {
    const remote = runGit(
      ['remote', 'get-url', remoteName],
      true,
    ).stdout.trim();
    const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
    if (match) return match[1];
  }
  throw new Error('Unable to resolve GitHub repo; pass --repo owner/name');
}

function fetchGhPaginatedArray(endpoint) {
  const res = runCmd('gh', ['api', '--paginate', '--slurp', endpoint], {
    allowFail: false,
  });
  const raw = (res.stdout || '').trim();
  if (!raw) return [];
  const pages = JSON.parse(raw);
  if (!Array.isArray(pages)) {
    throw new Error(`Unexpected response shape from ${endpoint}`);
  }
  return pages.flat();
}

function fetchEarliestPrReview(repo, prNumber) {
  const reviews = fetchGhPaginatedArray(
    `repos/${repo}/pulls/${prNumber}/reviews`,
  );
  const comments = fetchGhPaginatedArray(
    `repos/${repo}/pulls/${prNumber}/comments`,
  );
  const candidates = [];

  for (const r of reviews) {
    const substantive =
      (r.body && r.body.trim().length > 0) ||
      r.state === 'CHANGES_REQUESTED' ||
      r.state === 'COMMENTED';
    if (substantive && r.submitted_at) {
      candidates.push({
        at: r.submitted_at,
        commitId: r.commit_id || '',
        source: `review:${r.user?.login || 'unknown'}`,
      });
    }
  }
  for (const c of comments) {
    if (c.created_at) {
      candidates.push({
        at: c.created_at,
        commitId: c.original_commit_id || c.commit_id || '',
        source: `comment:${c.user?.login || 'unknown'}`,
      });
    }
  }
  const sorted = candidates.toSorted(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  return sorted[0] || null;
}

function ensureCommitAvailable(sha) {
  if (!sha) return false;
  if (refExists(sha)) return true;
  runGit(['fetch', 'origin', sha, '--no-tags'], true);
  return refExists(sha);
}

function computeMergeBase(baseRef, commitRef) {
  const mb = runGit(['merge-base', baseRef, commitRef], true);
  return mb.status === 0
    ? mb.stdout.trim()
    : runGit(['rev-parse', baseRef]).stdout.trim();
}

function resolveSnapshots(opts) {
  if (opts.since) {
    if (!refExists(opts.since)) {
      throw new Error(`--since ref not found: ${opts.since}`);
    }
    const baseRef = pickDefaultBase(opts.base);
    const preReviewSha = runGit(['rev-parse', opts.since]).stdout.trim();
    return {
      outcome: 'EVALUATE',
      skipped: false,
      mode: 'since',
      baseRef,
      preReviewSha,
      targetRef: null,
      origBase: computeMergeBase(baseRef, preReviewSha),
      currentBase: computeMergeBase(baseRef, 'HEAD'),
      baselineSource: `since:${opts.since}`,
    };
  }

  if (!opts.pr) {
    return {
      outcome: 'NO_BASELINE',
      skipped: true,
      skipReason: 'no_baseline_specified',
      mode: 'none',
      baseRef: pickDefaultBase(opts.base),
      preReviewSha: '',
      targetRef: null,
      origBase: '',
      currentBase: '',
      baselineSource: 'none',
    };
  }

  const repo = resolveRepoSlug(opts.repo);
  const prMetaRes = runCmd('gh', ['api', `repos/${repo}/pulls/${opts.pr}`], {
    allowFail: false,
  });
  const prMeta = JSON.parse(prMetaRes.stdout);
  const remoteBase = prMeta.base?.ref ? `origin/${prMeta.base.ref}` : '';
  const preferredBase =
    opts.base || (refExists(remoteBase) ? remoteBase : prMeta.base?.ref || '');
  const baseRef = pickDefaultBase(preferredBase);
  const targetSha = opts.head || prMeta.head?.sha || '';

  if (!opts.worktree && !ensureCommitAvailable(targetSha)) {
    throw new Error(`PR head commit not available locally: ${targetSha}`);
  }
  const targetRef = opts.worktree
    ? null
    : runGit(['rev-parse', targetSha]).stdout.trim();
  const currentBase = computeMergeBase(baseRef, targetRef || 'HEAD');

  const earliest = fetchEarliestPrReview(repo, opts.pr);
  if (!earliest) {
    return {
      outcome: 'NO_REVIEWS',
      skipped: true,
      skipReason: 'no_reviews_yet',
      mode: 'pr',
      baseRef,
      preReviewSha: '',
      targetRef,
      origBase: currentBase,
      currentBase,
      baselineSource: 'none',
    };
  }

  if (ensureCommitAvailable(earliest.commitId)) {
    const preReviewSha = runGit(['rev-parse', earliest.commitId]).stdout.trim();
    return {
      outcome: 'EVALUATE',
      skipped: false,
      mode: 'pr',
      baseRef,
      preReviewSha,
      targetRef,
      origBase: computeMergeBase(baseRef, preReviewSha),
      currentBase,
      baselineSource: `${earliest.source}@${earliest.at}`,
    };
  }

  const fallback = runGit(
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

  if (!fallback) {
    return {
      outcome: 'INCOMPLETE',
      skipped: true,
      skipReason: 'baseline_unreachable_after_rebase',
      mode: 'pr',
      baseRef,
      preReviewSha: '',
      targetRef,
      origBase: currentBase,
      currentBase,
      baselineSource: `${earliest.source}@${earliest.at}`,
    };
  }

  return {
    outcome: 'EVALUATE',
    skipped: false,
    mode: 'pr',
    baseRef,
    preReviewSha: fallback,
    targetRef,
    origBase: computeMergeBase(baseRef, fallback),
    currentBase,
    baselineSource: `${earliest.source}@${earliest.at} (timestamp-fallback)`,
  };
}

function parseUnifiedDiff(diffText) {
  const entries = [];
  let cur = null;
  let inHunk = false;
  const flush = () => {
    if (cur) entries.push(cur);
    cur = null;
    inHunk = false;
  };

  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      flush();
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      cur = {
        oldPath: match ? match[1] : '',
        newPath: match ? match[2] : '',
        isDeleted: false,
        isRename: false,
        addedLines: [],
        removedLines: [],
        oldEditedSpans: [],
        newAddedSpans: [],
      };
    } else if (cur) {
      if (line.startsWith('@@ ')) {
        inHunk = true;
        const oldM = line.match(/-(\d+)(?:,(\d+))?/);
        const newM = line.match(/\+(\d+)(?:,(\d+))?/);
        if (oldM) {
          const start = Number(oldM[1]);
          const count = oldM[2] === undefined ? 1 : Number(oldM[2]);
          if (count > 0) cur.oldEditedSpans.push({ start, count });
        }
        if (newM) {
          const start = Number(newM[1]);
          const count = newM[2] === undefined ? 1 : Number(newM[2]);
          if (count > 0) cur.newAddedSpans.push({ start, count });
        }
      } else if (!inHunk) {
        if (line.startsWith('rename from ')) {
          cur.isRename = true;
          cur.oldPath = line.slice(12);
        } else if (line.startsWith('rename to ')) {
          cur.isRename = true;
          cur.newPath = line.slice(10);
        } else if (line === '+++ /dev/null') {
          cur.isDeleted = true;
        }
      } else if (line.startsWith('+')) {
        cur.addedLines.push(line.slice(1));
      } else if (line.startsWith('-')) {
        cur.removedLines.push(line.slice(1));
      }
    }
  }
  flush();
  return entries;
}

function collectScopedPaths(rangeArgs, onlyPaths) {
  const statusOut = runGit([
    'diff',
    '-M',
    '--name-status',
    ...rangeArgs,
    '--',
  ]).stdout;
  const selected = new Set();
  for (const rawLine of statusOut.split('\n')) {
    const line = rawLine.trim();
    if (line) {
      const parts = line.split('\t');
      const status = parts[0] || '';
      const p1 = parts[1] || '';
      const p2 = parts[2] || '';
      const isRenameOrCopy = status.startsWith('R') || status.startsWith('C');
      const pathsToCheck = isRenameOrCopy ? [p1, p2] : [p1];
      const matchesCode = pathsToCheck.some((p) => isTargetCodeFile(p));
      const matchesFilter =
        !onlyPaths || pathsToCheck.some((p) => onlyPaths.has(p));
      if (matchesCode && matchesFilter) {
        for (const p of pathsToCheck) {
          if (p) selected.add(p);
        }
      }
    }
  }
  return [...selected].toSorted();
}

function buildChangeSet(
  fromRef,
  toRef,
  { includeUntracked = false, onlyPaths = null } = {},
) {
  const rangeArgs = toRef ? [fromRef, toRef] : [fromRef];
  const scopedPaths = collectScopedPaths(rangeArgs, onlyPaths);
  const diffText = scopedPaths.length
    ? runGit(['diff', '-M', '-U0', ...rangeArgs, '--', ...scopedPaths]).stdout
    : '';
  const rawEntries = parseUnifiedDiff(diffText);

  const files = [];
  const seenNewPaths = new Set();

  for (const e of rawEntries) {
    const primaryPath = e.isDeleted ? e.oldPath : e.newPath;
    const inScope =
      (isTargetCodeFile(e.newPath) || isTargetCodeFile(e.oldPath)) &&
      (!onlyPaths || onlyPaths.has(e.oldPath) || onlyPaths.has(e.newPath));
    if (inScope) {
      seenNewPaths.add(e.newPath);
      files.push({
        ...e,
        file: primaryPath,
        added: e.addedLines.length,
        deleted: e.removedLines.length,
        net: e.addedLines.length - e.removedLines.length,
      });
    }
  }

  if (includeUntracked) {
    const untracked = runGit([
      'ls-files',
      '--others',
      '--exclude-standard',
      '--',
    ])
      .stdout.split('\n')
      .map((s) => s.trim())
      .filter(
        (f) => isTargetCodeFile(f) && !seenNewPaths.has(f) && fs.existsSync(f),
      );

    for (const file of untracked) {
      if (!onlyPaths || onlyPaths.has(file)) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        files.push({
          file,
          oldPath: '',
          newPath: file,
          isDeleted: false,
          isRename: false,
          addedLines: lines,
          removedLines: [],
          oldEditedSpans: [],
          newAddedSpans: [{ start: 1, count: lines.length }],
          added: lines.length,
          deleted: 0,
          net: lines.length,
        });
      }
    }
  }

  let added = 0;
  let deleted = 0;
  const paths = new Set();
  for (const f of files) {
    added += f.added;
    deleted += f.deleted;
    if (f.oldPath) paths.add(f.oldPath);
    if (f.newPath) paths.add(f.newPath);
  }

  return {
    files,
    paths,
    added,
    deleted,
    net: added - deleted,
    hotspots: files
      .map((f) => ({
        file: f.file,
        added: f.added,
        deleted: f.deleted,
        net: f.net,
      }))
      .toSorted((a, b) => b.net - a.net)
      .slice(0, 5),
  };
}

function measureSelfChurn(origChangeSet, fixChangeSet) {
  const origAddedByFile = new Map();
  let origPrAddedLines = 0;
  for (const f of origChangeSet.files) {
    if (!f.isDeleted && f.newPath) {
      const set = origAddedByFile.get(f.newPath) || new Set();
      for (const span of f.newAddedSpans) {
        for (let ln = span.start; ln < span.start + span.count; ln += 1) {
          set.add(ln);
          origPrAddedLines += 1;
        }
      }
      origAddedByFile.set(f.newPath, set);
    }
  }

  if (!origPrAddedLines || !fixChangeSet.files.length) {
    return { origPrAddedLines, reEditedPrLines: 0, ratio: 0, triggered: false };
  }

  let reEditedPrLines = 0;
  for (const f of fixChangeSet.files) {
    const origSet = origAddedByFile.get(f.oldPath || f.file);
    if (origSet && f.oldEditedSpans.length) {
      const hit = new Set();
      for (const span of f.oldEditedSpans) {
        for (let ln = span.start; ln < span.start + span.count; ln += 1) {
          if (origSet.has(ln)) hit.add(ln);
        }
      }
      reEditedPrLines += hit.size;
    }
  }

  const ratio = Number((reEditedPrLines / origPrAddedLines).toFixed(3));
  const triggered =
    reEditedPrLines >= THRESHOLDS.minSelfChurnLines &&
    ratio >= THRESHOLDS.maxSelfChurnRatio;
  return { origPrAddedLines, reEditedPrLines, ratio, triggered };
}

function stripNonExecutableLines(lines) {
  const out = [];
  let inBlockComment = false;
  for (const raw of lines) {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) {
        line = '';
      } else {
        line = line.slice(end + 2);
        inBlockComment = false;
      }
    }
    line = line.replace(/\/\*[\s\S]*?\*\//g, '');
    const blockStart = line.indexOf('/*');
    if (blockStart !== -1) {
      line = line.slice(0, blockStart);
      inBlockComment = true;
    }
    const trimmed = line.replace(/\/\/.*$/, '').trim();
    if (
      trimmed &&
      !/^(?:import\b|export\s+type\b|type\s+[A-Za-z0-9_]+\s*=|interface\s+[A-Za-z0-9_]+)/.test(
        trimmed,
      )
    ) {
      out.push(trimmed);
    }
  }
  return out.join('\n');
}

function analyzeExecutablePatterns(fixChangeSet) {
  let netStateFlags = 0;
  const stateHotspots = [];
  const scopeCreepWarnings = [];
  const countMatches = (text, patterns) =>
    patterns.reduce((sum, re) => sum + (text.match(re) || []).length, 0);

  for (const f of fixChangeSet.files) {
    const addedText = stripNonExecutableLines(f.addedLines);
    const removedText = stripNonExecutableLines(f.removedLines);

    const stateDelta =
      countMatches(addedText, STATE_FLAG_PATTERNS) -
      countMatches(removedText, STATE_FLAG_PATTERNS);
    netStateFlags += stateDelta;
    if (stateDelta > 0) stateHotspots.push({ file: f.file, delta: stateDelta });

    for (const pattern of UI_OVERLAY_PATTERNS) {
      const delta =
        (addedText.match(pattern) || []).length -
        (removedText.match(pattern) || []).length;
      if (delta > 0) {
        scopeCreepWarnings.push({
          file: f.file,
          type: 'ui-overlay',
          detail: `Added ${delta} net new UI overlay match(es) (${pattern.source})`,
        });
      }
    }

    const removedKeys = new Set(removedText.match(I18N_KEY_RE) || []);
    const newKeys = [...new Set(addedText.match(I18N_KEY_RE) || [])].filter(
      (k) => !removedKeys.has(k),
    );
    if (newKeys.length) {
      scopeCreepWarnings.push({
        file: f.file,
        type: 'i18n-copy',
        detail: `Introduced ${newKeys.length} new i18n key(s): ${newKeys.slice(0, 5).join(', ')}`,
      });
    }
  }

  return {
    netStateFlags,
    stateHotspots: stateHotspots.toSorted((a, b) => b.delta - a.delta),
    scopeCreepWarnings,
  };
}

function resolveOxlintBin(explicitPath) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (fs.existsSync(resolved)) return resolved;
  }
  const binName = process.platform === 'win32' ? 'oxlint.cmd' : 'oxlint';
  const localBin = path.resolve('node_modules', '.bin', binName);
  return fs.existsSync(localBin) ? localBin : '';
}

function runNestingRatchet(preReviewSha, targetRef, fixChangeSet, oxlintPath) {
  const oxlintBin = resolveOxlintBin(oxlintPath);
  const candidates = fixChangeSet.files.filter(
    (f) => !f.isDeleted && isTargetCodeFile(f.newPath),
  );
  if (!candidates.length) {
    return { nestingChecked: true, nestingRegressions: [], reason: null };
  }
  if (!oxlintBin) {
    return {
      nestingChecked: false,
      nestingRegressions: [],
      reason: 'oxlint_not_found',
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-bloat-'));
  try {
    const cfgPath = path.join(tmpDir, 'oxlint-nesting.json');
    const off = Object.fromEntries(
      [
        'correctness',
        'suspicious',
        'pedantic',
        'perf',
        'style',
        'restriction',
        'nursery',
      ].map((c) => [c, 'off']),
    );
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        categories: off,
        rules: {
          'max-depth': ['error', THRESHOLDS.maxDepth],
          'max-nested-callbacks': ['error', THRESHOLDS.maxNestedCallbacks],
        },
      }),
    );

    const beforeDir = path.join(tmpDir, 'before');
    const afterDir = path.join(tmpDir, 'after');
    fs.mkdirSync(beforeDir, { recursive: true });
    fs.mkdirSync(afterDir, { recursive: true });

    const beforeFiles = [];
    const afterFiles = [];
    for (const f of candidates) {
      const beforePath = f.oldPath || f.newPath;
      const beforeShow = runGit(
        ['show', `${preReviewSha}:${beforePath}`],
        true,
      );
      if (beforeShow.status === 0) {
        const dest = path.join(beforeDir, f.newPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, beforeShow.stdout);
        beforeFiles.push(f.newPath);
      }
      if (targetRef) {
        const afterShow = runGit(['show', `${targetRef}:${f.newPath}`], true);
        if (afterShow.status === 0) {
          const dest = path.join(afterDir, f.newPath);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, afterShow.stdout);
          afterFiles.push(f.newPath);
        }
      } else if (fs.existsSync(f.newPath)) {
        afterFiles.push(f.newPath);
      }
    }

    const runLint = (targetFiles, cwd) => {
      if (!targetFiles.length) return [];
      const res = runCmd(
        oxlintBin,
        [
          '-c',
          cfgPath,
          '--format',
          'json',
          '--no-error-on-unmatched-pattern',
          ...targetFiles,
        ],
        { cwd, allowFail: true },
      );
      const raw = (res.stdout || '').trim();
      const idx = raw.indexOf('{');
      if (idx === -1) {
        throw new Error(`oxlint produced no JSON diagnostics: ${res.stderr}`);
      }
      return (JSON.parse(raw.slice(idx)).diagnostics || []).map((d) => {
        const m = (d.message || '').match(/(\d+)/);
        return {
          file: d.filename,
          rule: d.code || 'unknown',
          line: d.labels?.[0]?.span?.line || 0,
          message: d.message || '',
          metric: m ? Number(m[1]) : 1,
        };
      });
    };

    const group = (diags) => {
      const map = new Map();
      for (const d of diags) {
        const k = `${d.file}::${d.rule}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(d);
      }
      return map;
    };

    const beforeMap = group(runLint(beforeFiles, beforeDir));
    const afterMap = group(
      runLint(afterFiles, targetRef ? afterDir : process.cwd()),
    );
    const regressions = [];

    for (const [key, afterList] of afterMap.entries()) {
      const beforeMetrics = (beforeMap.get(key) || [])
        .map((d) => d.metric)
        .toSorted((a, b) => b - a);
      const sortedAfter = afterList.toSorted((a, b) => b.metric - a.metric);
      for (let i = 0; i < sortedAfter.length; i += 1) {
        const prev = beforeMetrics[i];
        if (prev === undefined || sortedAfter[i].metric > prev) {
          regressions.push({ ...sortedAfter[i], beforeMetric: prev ?? null });
        }
      }
    }
    return {
      nestingChecked: true,
      nestingRegressions: regressions,
      reason: null,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function printHumanReport(report) {
  if (report.skipped) {
    console.log(
      `[check:bloat] ${report.outcome} (${report.skipReason}) — VERDICT: ${report.verdict}`,
    );
    return;
  }
  const { amplification, selfChurn, stateAndNesting, scopeCreepWarnings } =
    report;
  console.log(
    `[check:bloat] mode=${report.mode} baseline=${report.preReviewSha.slice(0, 10)} (${report.baselineSource}) files=${report.filesChecked}`,
  );
  console.log(
    `  1. Fix Amplification: fix +${amplification.fixAdded}/-${amplification.fixDeleted} (net ${amplification.fixNet >= 0 ? '+' : ''}${amplification.fixNet}) vs orig PR net +${amplification.origNet} | ratio=${(amplification.amplificationRatio * 100).toFixed(0)}% | del/add=${(amplification.deletionRatio * 100).toFixed(0)}% [${amplification.triggered ? 'FAIL' : 'OK'}]`,
  );
  console.log(
    `  2. Self-Churn: ${selfChurn.reEditedPrLines}/${selfChurn.origPrAddedLines} PR-added lines re-edited (${(selfChurn.ratio * 100).toFixed(0)}%) [${selfChurn.triggered ? 'FAIL' : 'OK'}]`,
  );
  const nestingLabel = stateAndNesting.nestingChecked
    ? `nesting regressions=${stateAndNesting.nestingRegressions.length}`
    : `nesting=SKIPPED(${stateAndNesting.nestingSkipReason})`;
  console.log(
    `  3. State & Nesting: net state/ref flags=${stateAndNesting.netStateFlags >= 0 ? '+' : ''}${stateAndNesting.netStateFlags} (limit < ${THRESHOLDS.maxNetStateFlags}) | ${nestingLabel} [${stateAndNesting.triggered ? 'FAIL' : 'OK'}]`,
  );
  if (scopeCreepWarnings.length) {
    console.log('\n[SCOPE_CREEP_WARN] Possible Review-Fix Scope Creep:');
    for (const w of scopeCreepWarnings) {
      console.log(`  - ${w.file} [${w.type}]: ${w.detail}`);
    }
  }
  console.log(
    report.verdict === 'REFACTOR_REQUIRED'
      ? '\nVERDICT: REFACTOR_REQUIRED — Stop stacking patches. Cluster root causes and propose a boundary/state-machine refactor (or apply `bloat-reviewed` label if human-approved).'
      : '\nVERDICT: PASS',
  );
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const snap = resolveSnapshots(opts);
  if (snap.skipped) {
    const skippedReport = { ...snap, verdict: 'PASS' };
    if (opts.json) console.log(JSON.stringify(skippedReport, null, 2));
    else printHumanReport(skippedReport);
    process.exit(0);
  }

  const includeUntracked = snap.targetRef === null;
  const origChangeSet = buildChangeSet(snap.origBase, snap.preReviewSha, {
    includeUntracked: false,
  });
  const currChangeSet = buildChangeSet(snap.currentBase, snap.targetRef, {
    includeUntracked,
  });
  const prOwnedPaths = new Set([
    ...origChangeSet.paths,
    ...currChangeSet.paths,
  ]);
  const baseAdvanced = snap.origBase !== snap.currentBase;
  const fixChangeSet = buildChangeSet(snap.preReviewSha, snap.targetRef, {
    includeUntracked,
    onlyPaths: baseAdvanced ? prOwnedPaths : null,
  });

  if (!fixChangeSet.files.length) {
    const emptyReport = {
      ...snap,
      verdict: 'PASS',
      outcome: 'NO_CODE_CHANGES',
      skipped: true,
      skipReason: 'no_code_changes_since_review',
    };
    if (opts.json) console.log(JSON.stringify(emptyReport, null, 2));
    else printHumanReport(emptyReport);
    process.exit(0);
  }

  const origNet = Math.max(0, origChangeSet.net);
  const fixNet = baseAdvanced
    ? currChangeSet.net - origChangeSet.net
    : fixChangeSet.net;
  const fixAdded = fixChangeSet.added;
  const fixDeleted = fixChangeSet.deleted;

  let amplificationRatio = 0;
  if (origNet > 0) amplificationRatio = Number((fixNet / origNet).toFixed(3));
  else if (fixNet > 0) amplificationRatio = 999;

  const deletionRatio =
    fixAdded > 0 ? Number((fixDeleted / fixAdded).toFixed(3)) : 1;
  const amplificationTriggered =
    fixNet >= THRESHOLDS.minFixNetLines &&
    amplificationRatio >= THRESHOLDS.maxAmplificationRatio &&
    deletionRatio < THRESHOLDS.minDeletionRatio;

  const selfChurn = measureSelfChurn(origChangeSet, fixChangeSet);
  const { netStateFlags, stateHotspots, scopeCreepWarnings } =
    analyzeExecutablePatterns(fixChangeSet);
  const {
    nestingChecked,
    nestingRegressions,
    reason: nestingSkipReason,
  } = runNestingRatchet(
    snap.preReviewSha,
    snap.targetRef,
    fixChangeSet,
    opts.oxlint,
  );
  const stateTriggered =
    netStateFlags >= THRESHOLDS.maxNetStateFlags ||
    nestingRegressions.length > 0;

  const hasHardFailure =
    amplificationTriggered ||
    selfChurn.triggered ||
    stateTriggered ||
    (opts.strictScope && scopeCreepWarnings.length > 0);

  const report = {
    ...snap,
    verdict: hasHardFailure ? 'REFACTOR_REQUIRED' : 'PASS',
    outcome: hasHardFailure ? 'REFACTOR_REQUIRED' : 'PASS',
    skipped: false,
    thresholds: THRESHOLDS,
    filesChecked: fixChangeSet.files.length,
    amplification: {
      origAdded: origChangeSet.added,
      origDeleted: origChangeSet.deleted,
      origNet,
      fixAdded,
      fixDeleted,
      fixNet,
      amplificationRatio,
      deletionRatio,
      hotspots: fixChangeSet.hotspots,
      triggered: amplificationTriggered,
    },
    selfChurn,
    stateAndNesting: {
      netStateFlags,
      stateHotspots,
      nestingChecked,
      nestingSkipReason,
      nestingRegressions,
      triggered: stateTriggered,
    },
    scopeCreepWarnings,
  };

  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else printHumanReport(report);
  if (hasHardFailure && !opts.warnOnly) process.exit(2);
}

try {
  main();
} catch (err) {
  console.error(`[check:bloat] Error: ${err.message}`);
  process.exit(1);
}
