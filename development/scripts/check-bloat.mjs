#!/usr/bin/env node
/**
 * Review-Fix Bloat & Refactor Gate.
 *
 * Measures three review-phase health metrics anchored at the pre-review baseline
 * (auto-detected from a PR's earliest review commit via --pr, or explicit --since):
 *   1. Fix amplification & deletion-to-addition ratio (anti-patch-stacking)
 *   2. Self-churn ratio (re-editing lines newly introduced by the PR itself)
 *   3. Implicit state-flag growth & nesting-depth ratchet (anti-state-explosion)
 * Plus a scope-creep detector for unapproved UI overlays and new i18n keys.
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
      '  --pr <number>    Auto-detect pre-review baseline from earliest PR review via gh CLI',
      '  --repo <o/r>     GitHub repo (owner/name) for --pr (optional, defaults to current repo)',
      '  --base <ref>     PR base branch/ref (default: PR base, origin/x, or x)',
      '  --since <ref>    Explicit pre-review baseline SHA/ref',
      '  --warn-only      Report without failing (exit 0)',
      '  --strict-scope   Treat scope-creep warnings as hard failures (exit 2)',
      '  --json           Output JSON',
      'Exit codes: 0=PASS, 2=REFACTOR_REQUIRED, 1=error',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const opts = {
    pr: '',
    repo: '',
    base: '',
    since: '',
    warnOnly: false,
    strictScope: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--warn-only') opts.warnOnly = true;
    else if (arg === '--strict-scope') opts.strictScope = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--pr') {
      i += 1;
      opts.pr = argv[i] || '';
    } else if (arg.startsWith('--pr=')) opts.pr = arg.slice(5);
    else if (arg === '--repo') {
      i += 1;
      opts.repo = argv[i] || '';
    } else if (arg.startsWith('--repo=')) opts.repo = arg.slice(7);
    else if (arg === '--base') {
      i += 1;
      opts.base = argv[i] || '';
    } else if (arg.startsWith('--base=')) opts.base = arg.slice(7);
    else if (arg === '--since') {
      i += 1;
      opts.since = argv[i] || '';
    } else if (arg.startsWith('--since=')) opts.since = arg.slice(8);
    else throw new Error(`Unknown option: ${arg}`);
  }
  return opts;
}

function runCmd(cmd, args, { cwd, allowFail = false } = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
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

const runGit = (args, allowFail = false) => runCmd('git', args, { allowFail });

const refExists = (ref) =>
  runGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], true)
    .status === 0;

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
  const remote = runGit(['remote', 'get-url', 'origin'], true).stdout.trim();
  const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
  if (match) return match[1];
  const ghOut = runCmd(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    { allowFail: true },
  );
  if (ghOut.status === 0 && ghOut.stdout.trim()) return ghOut.stdout.trim();
  throw new Error('Unable to resolve GitHub repo; pass --repo owner/name');
}

function fetchEarliestPrReview(repo, prNumber) {
  const reviewsRes = runCmd(
    'gh',
    ['api', '--paginate', `repos/${repo}/pulls/${prNumber}/reviews`],
    { allowFail: true },
  );
  const commentsRes = runCmd(
    'gh',
    ['api', '--paginate', `repos/${repo}/pulls/${prNumber}/comments`],
    { allowFail: true },
  );

  const parseArray = (res) => {
    if (res.status !== 0 || !res.stdout.trim()) return [];
    const parsed = JSON.parse(res.stdout);
    return Array.isArray(parsed) ? parsed : [];
  };

  const candidates = [];
  for (const r of parseArray(reviewsRes)) {
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
  for (const c of parseArray(commentsRes)) {
    if (c.created_at) {
      candidates.push({
        at: c.created_at,
        commitId: c.original_commit_id || c.commit_id || '',
        source: `comment:${c.user?.login || 'unknown'}`,
      });
    }
  }
  candidates.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return candidates[0] || null;
}

function resolveBaseline(opts) {
  let prBaseRef = opts.base;
  if (opts.pr && !prBaseRef) {
    const prView = runCmd(
      'gh',
      ['pr', 'view', opts.pr, '--json', 'baseRefName', '-q', '.baseRefName'],
      { allowFail: true },
    );
    if (prView.status === 0 && prView.stdout.trim()) {
      prBaseRef = prView.stdout.trim();
    }
  }

  const baseRef = pickDefaultBase(prBaseRef);
  const mergeBaseRes = runGit(['merge-base', baseRef, 'HEAD'], true);
  const origBase =
    mergeBaseRes.status === 0
      ? mergeBaseRes.stdout.trim()
      : runGit(['rev-parse', baseRef]).stdout.trim();

  if (opts.since) {
    if (!refExists(opts.since)) {
      throw new Error(`--since ref not found: ${opts.since}`);
    }
    return {
      skipped: false,
      mode: 'since',
      baseRef,
      origBase,
      preReviewSha: runGit(['rev-parse', opts.since]).stdout.trim(),
      baselineSource: `since:${opts.since}`,
    };
  }

  if (!opts.pr) {
    return {
      skipped: true,
      skipReason: 'no_baseline_specified',
      mode: 'none',
      baseRef,
      origBase,
      preReviewSha: '',
      baselineSource: 'none',
    };
  }

  const repo = resolveRepoSlug(opts.repo);
  const earliest = fetchEarliestPrReview(repo, opts.pr);
  if (!earliest) {
    return {
      skipped: true,
      skipReason: 'no_reviews_yet',
      mode: 'pr',
      baseRef,
      origBase,
      preReviewSha: '',
      baselineSource: 'none',
    };
  }

  if (earliest.commitId && refExists(earliest.commitId)) {
    return {
      skipped: false,
      mode: 'pr',
      baseRef,
      origBase,
      preReviewSha: runGit(['rev-parse', earliest.commitId]).stdout.trim(),
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
      `${origBase}..HEAD`,
    ],
    true,
  ).stdout.trim();

  if (!fallback) {
    return {
      skipped: true,
      skipReason: 'baseline_unreachable_after_rebase',
      mode: 'pr',
      baseRef,
      origBase,
      preReviewSha: '',
      baselineSource: `${earliest.source}@${earliest.at}`,
    };
  }

  return {
    skipped: false,
    mode: 'pr',
    baseRef,
    origBase,
    preReviewSha: fallback,
    baselineSource: `${earliest.source}@${earliest.at} (timestamp-fallback)`,
  };
}

function getTargetCodeFiles(diffArgs, includeUntracked = false) {
  const splitLines = (out) =>
    out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  const tracked = splitLines(
    runGit(['diff', '--name-only', '--diff-filter=ACMR', ...diffArgs, '--'])
      .stdout,
  );
  const untracked = includeUntracked
    ? splitLines(
        runGit(['ls-files', '--others', '--exclude-standard', '--']).stdout,
      )
    : [];
  return [...new Set([...tracked, ...untracked])]
    .filter((f) => CODE_FILE_RE.test(f) && !EXCLUDED_PATH_RE.test(f))
    .toSorted();
}

function sumDiffStat(diffArgs, files, includeUntracked = false) {
  let added = 0;
  let deleted = 0;
  const perFile = [];
  if (files.length) {
    const out = runGit([
      'diff',
      '--numstat',
      ...diffArgs,
      '--',
      ...files,
    ]).stdout;
    const seen = new Set();
    for (const line of out.split('\n').filter(Boolean)) {
      const [aStr, dStr, file] = line.split('\t');
      if (file && aStr !== '-' && dStr !== '-') {
        seen.add(file);
        const a = Number(aStr);
        const d = Number(dStr);
        added += a;
        deleted += d;
        perFile.push({ file, added: a, deleted: d, net: a - d });
      }
    }
    if (includeUntracked) {
      for (const file of files) {
        if (!seen.has(file) && fs.existsSync(file)) {
          const lines = fs.readFileSync(file, 'utf8').split('\n').length;
          added += lines;
          perFile.push({ file, added: lines, deleted: 0, net: lines });
        }
      }
    }
  }
  return {
    added,
    deleted,
    net: added - deleted,
    hotspots: perFile.toSorted((a, b) => b.net - a.net).slice(0, 5),
  };
}

function collectOrigAddedLines(origBase, preReviewSha, files) {
  const lineMap = new Map();
  let total = 0;
  if (!files.length) return { lineMap, total };

  const diffOut = runGit([
    'diff',
    '-U0',
    origBase,
    preReviewSha,
    '--',
    ...files,
  ]).stdout;
  let currentFile = '';
  for (const line of diffOut.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      if (!lineMap.has(currentFile)) lineMap.set(currentFile, new Set());
    } else if (line.startsWith('@@ ') && currentFile) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      if (match) {
        const start = Number(match[1]);
        const count = match[2] === undefined ? 1 : Number(match[2]);
        const set = lineMap.get(currentFile);
        for (let ln = start; ln < start + count; ln += 1) {
          set.add(ln);
          total += 1;
        }
      }
    }
  }
  return { lineMap, total };
}

function measureSelfChurn(origBase, preReviewSha, fixFiles) {
  const origFiles = getTargetCodeFiles([origBase, preReviewSha], false);
  const { lineMap, total: origPrAddedLines } = collectOrigAddedLines(
    origBase,
    preReviewSha,
    origFiles,
  );
  if (!origPrAddedLines || !fixFiles.length) {
    return {
      origPrAddedLines,
      reEditedPrLines: 0,
      ratio: 0,
      triggered: false,
    };
  }

  const diffOut = runGit([
    'diff',
    '-U0',
    preReviewSha,
    '--',
    ...fixFiles,
  ]).stdout;
  let currentFile = '';
  const touched = new Map();

  for (const line of diffOut.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
    } else if (line.startsWith('@@ ') && currentFile) {
      const origSet = lineMap.get(currentFile);
      const match = line.match(/-(\d+)(?:,(\d+))?/);
      if (origSet && match) {
        const start = Number(match[1]);
        const count = match[2] === undefined ? 1 : Number(match[2]);
        if (!touched.has(currentFile)) touched.set(currentFile, new Set());
        const hitSet = touched.get(currentFile);
        const spanEnd = Math.max(start + count, start + 1);
        for (let ln = Math.max(1, start); ln < spanEnd; ln += 1) {
          if (origSet.has(ln)) hitSet.add(ln);
        }
      }
    }
  }

  let reEditedPrLines = 0;
  for (const set of touched.values()) reEditedPrLines += set.size;
  const ratio = Number((reEditedPrLines / origPrAddedLines).toFixed(3));
  const triggered =
    reEditedPrLines >= THRESHOLDS.minSelfChurnLines &&
    ratio >= THRESHOLDS.maxSelfChurnRatio;
  return { origPrAddedLines, reEditedPrLines, ratio, triggered };
}

function analyzeDiffPatterns(preReviewSha, files) {
  if (!files.length) {
    return { netStateFlags: 0, stateHotspots: [], scopeCreepWarnings: [] };
  }
  const diffOut = runGit(['diff', '-U0', preReviewSha, '--', ...files]).stdout;
  let currentFile = '';
  let addedLines = [];
  let removedLines = [];
  let totalNetStateFlags = 0;
  const stateHotspots = [];
  const scopeCreepWarnings = [];

  const countMatches = (text, patterns) =>
    patterns.reduce((sum, re) => sum + (text.match(re) || []).length, 0);

  const flushFile = () => {
    if (!currentFile) return;
    const addedText = addedLines.join('\n');
    const removedText = removedLines.join('\n');

    const stateDelta =
      countMatches(addedText, STATE_FLAG_PATTERNS) -
      countMatches(removedText, STATE_FLAG_PATTERNS);
    if (stateDelta !== 0) totalNetStateFlags += stateDelta;
    if (stateDelta > 0)
      stateHotspots.push({ file: currentFile, delta: stateDelta });

    for (const pattern of UI_OVERLAY_PATTERNS) {
      const delta =
        (addedText.match(pattern) || []).length -
        (removedText.match(pattern) || []).length;
      if (delta > 0) {
        scopeCreepWarnings.push({
          file: currentFile,
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
        file: currentFile,
        type: 'i18n-copy',
        detail: `Introduced ${newKeys.length} new i18n key(s): ${newKeys.slice(0, 5).join(', ')}`,
      });
    }
  };

  for (const line of diffOut.split('\n')) {
    if (line.startsWith('+++ b/')) {
      flushFile();
      currentFile = line.slice(6);
      addedLines = [];
      removedLines = [];
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines.push(line.slice(1));
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removedLines.push(line.slice(1));
    }
  }
  flushFile();

  return {
    netStateFlags: totalNetStateFlags,
    stateHotspots: stateHotspots.toSorted((a, b) => b.delta - a.delta),
    scopeCreepWarnings,
  };
}

function runNestingRatchet(preReviewSha, files) {
  const existing = files.filter((f) => fs.existsSync(f));
  if (!existing.length) return [];

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
    fs.mkdirSync(beforeDir, { recursive: true });
    const beforeFiles = [];
    for (const relPath of existing) {
      const show = runGit(['show', `${preReviewSha}:${relPath}`], true);
      if (show.status === 0) {
        const dest = path.join(beforeDir, relPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, show.stdout);
        beforeFiles.push(relPath);
      }
    }

    const binName = process.platform === 'win32' ? 'oxlint.cmd' : 'oxlint';
    const localBin = path.resolve('node_modules', '.bin', binName);
    if (!fs.existsSync(localBin)) {
      return [];
    }
    const oxlintBin = localBin;

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
      if (idx === -1) return [];
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
    const afterMap = group(runLint(existing, process.cwd()));
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
    return regressions;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function printHumanReport(report) {
  if (report.skipped) {
    console.log(
      `[check:bloat] SKIP (${report.skipReason}) — no review-fix baseline to evaluate. VERDICT: PASS`,
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
  console.log(
    `  3. State & Nesting: net state/ref flags=${stateAndNesting.netStateFlags >= 0 ? '+' : ''}${stateAndNesting.netStateFlags} (limit < ${THRESHOLDS.maxNetStateFlags}) | nesting regressions=${stateAndNesting.nestingRegressions.length} [${stateAndNesting.triggered ? 'FAIL' : 'OK'}]`,
  );

  if (amplification.hotspots.length) {
    console.log('\nTop Growth Hotspots (Review-Fix Phase):');
    for (const h of amplification.hotspots) {
      console.log(
        `  - ${h.file}: +${h.added}/-${h.deleted} (net ${h.net >= 0 ? '+' : ''}${h.net})`,
      );
    }
  }
  if (stateAndNesting.nestingRegressions.length) {
    console.log('\nNesting Depth Regressions:');
    for (const r of stateAndNesting.nestingRegressions) {
      const delta =
        r.beforeMetric === null
          ? `new (${r.metric})`
          : `${r.beforeMetric} -> ${r.metric}`;
      console.log(`  - ${r.file}:${r.line} [${r.rule}] ${delta}`);
    }
  }
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

  const baseInfo = resolveBaseline(opts);
  if (baseInfo.skipped) {
    const skippedReport = { verdict: 'PASS', ...baseInfo };
    if (opts.json) console.log(JSON.stringify(skippedReport, null, 2));
    else printHumanReport(skippedReport);
    process.exit(0);
  }

  const { origBase, preReviewSha } = baseInfo;
  const origFiles = getTargetCodeFiles([origBase, preReviewSha], false);
  const fixFiles = getTargetCodeFiles([preReviewSha], true);

  if (!fixFiles.length) {
    const emptyReport = {
      verdict: 'PASS',
      skipped: true,
      skipReason: 'no_code_changes_since_review',
      ...baseInfo,
    };
    if (opts.json) console.log(JSON.stringify(emptyReport, null, 2));
    else printHumanReport(emptyReport);
    process.exit(0);
  }

  const origStats = sumDiffStat([origBase, preReviewSha], origFiles, false);
  const fixStats = sumDiffStat([preReviewSha], fixFiles, true);
  const origNet = Math.max(0, origStats.net);
  let amplificationRatio = 0;
  if (origNet > 0) {
    amplificationRatio = Number((fixStats.net / origNet).toFixed(3));
  } else if (fixStats.net > 0) {
    amplificationRatio = 999;
  }
  const deletionRatio =
    fixStats.added > 0
      ? Number((fixStats.deleted / fixStats.added).toFixed(3))
      : 1;
  const amplificationTriggered =
    fixStats.net >= THRESHOLDS.minFixNetLines &&
    amplificationRatio >= THRESHOLDS.maxAmplificationRatio &&
    deletionRatio < THRESHOLDS.minDeletionRatio;

  const selfChurn = measureSelfChurn(origBase, preReviewSha, fixFiles);
  const { netStateFlags, stateHotspots, scopeCreepWarnings } =
    analyzeDiffPatterns(preReviewSha, fixFiles);
  const nestingRegressions = runNestingRatchet(preReviewSha, fixFiles);
  const stateTriggered =
    netStateFlags >= THRESHOLDS.maxNetStateFlags ||
    nestingRegressions.length > 0;

  const hasHardFailure =
    amplificationTriggered ||
    selfChurn.triggered ||
    stateTriggered ||
    (opts.strictScope && scopeCreepWarnings.length > 0);

  const report = {
    verdict: hasHardFailure ? 'REFACTOR_REQUIRED' : 'PASS',
    skipped: false,
    ...baseInfo,
    thresholds: THRESHOLDS,
    filesChecked: fixFiles.length,
    amplification: {
      origAdded: origStats.added,
      origDeleted: origStats.deleted,
      origNet,
      fixAdded: fixStats.added,
      fixDeleted: fixStats.deleted,
      fixNet: fixStats.net,
      amplificationRatio,
      deletionRatio,
      hotspots: fixStats.hotspots,
      triggered: amplificationTriggered,
    },
    selfChurn,
    stateAndNesting: {
      netStateFlags,
      stateHotspots,
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
