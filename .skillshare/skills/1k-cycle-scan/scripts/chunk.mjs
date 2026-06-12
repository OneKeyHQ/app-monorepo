#!/usr/bin/env node
/**
 * 1k-cycle-scan slice planner.
 *
 * Takes the deterministic manifest plus a run's start cursor and emits that
 * run's files, pre-grouped into line-balanced agent workloads.
 *
 * v6 semantics: run boundaries are FIXED by the batch's run table
 * (--plan-runs below); execution replays one table run via
 * `--cursor <run.start> --lines <table.runLines>` and asserts
 * proposedCursor == run.end. Repair/takeover of a partially scanned run
 * passes the already-checkpointed indices via --done-indices TOGETHER WITH
 * --preserve-group-ids: the original slice is reconstructed and only missing
 * original group IDs are emitted. The fill-budget mode (--done-indices
 * without --preserve-group-ids) skips done files and refills the budget from
 * later entries — it crosses table boundaries and is NOT valid in v6.
 *
 * Usage:
 *   node chunk.mjs --manifest /tmp/manifest.jsonl --cursor 0
 *                  [--lines 50000] [--group-lines 4000] [--group-files 25]
 *                  [--done-indices "12,13,40"] [--preserve-group-ids]
 *                  [--out /tmp/groups.json]
 *
 * Run-table mode (batch planning, Flow C):
 *   node chunk.mjs --manifest /tmp/manifest.jsonl --cursor 0 --lines 50000 \
 *                  --plan-runs [--first-run 1] [--out /tmp/runs.json]
 * Emits the whole batch pre-sliced into runs. Boundaries use the exact same
 * accumulation rule as normal slicing, so `--cursor <start> --lines <N>`
 * reproduces each run verbatim at execution time (runners assert
 * proposedCursor == end).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Defaults calibrated 2026-06: ~50k lines per run keeps a full batch around
// 20 runs; ~4000 lines (or 25 files) per group fits one deep-reading agent.
const DEFAULTS = { lines: 50_000, groupLines: 4000, groupFiles: 25 };

// Read probes: the agent Read tool returns at most ~2000 lines per call, so
// only files beyond that can be silently truncated by a lazy reader. For such
// files we pick a deep line whose CONTENT the scan agent must echo back; the
// orchestrator verifies it against the worktree. Position is deterministic —
// the content is the secret, so determinism does not weaken the check.
const PROBE_MIN_FILE_LINES = 1800;
const PROBE_MIN_CHARS = 12;

const ARG_NAME_BY_KEY = {
  lines: 'lines',
  groupLines: 'group-lines',
  groupFiles: 'group-files',
};

function pickProbeLine(repo, relPath, totalLines) {
  let text;
  try {
    text = readFileSync(join(repo, relPath), 'utf8').split('\n');
  } catch {
    return null;
  }
  // Pick the LONGEST line in the tail window — distinctive content that
  // cannot be guessed from generic file endings like `});`.
  const end = Math.min(totalLines, text.length);
  const start = Math.max(1, end - 150);
  let best = null;
  let bestLen = PROBE_MIN_CHARS - 1;
  for (let ln = start; ln <= end; ln += 1) {
    const len = (text[ln - 1] ?? '').trim().length;
    if (len >= bestLen) {
      best = ln;
      bestLen = len;
    }
  }
  return best;
}

function parseArgs(argv) {
  const args = {
    ...DEFAULTS,
    cursor: 0,
    doneIndices: [],
    preserveGroupIds: false,
    planRuns: false,
    firstRun: 1,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--manifest') args.manifest = argv[(i += 1)];
    else if (a === '--repo') args.repo = argv[(i += 1)];
    else if (a === '--cursor') args.cursor = Number(argv[(i += 1)]);
    else if (a === '--lines') args.lines = Number(argv[(i += 1)]);
    else if (a === '--group-lines') args.groupLines = Number(argv[(i += 1)]);
    else if (a === '--group-files') args.groupFiles = Number(argv[(i += 1)]);
    else if (a === '--done-indices') {
      args.doneIndices = argv[(i += 1)].split(',').filter(Boolean).map(Number);
    } else if (a === '--preserve-group-ids') args.preserveGroupIds = true;
    else if (a === '--plan-runs') args.planRuns = true;
    else if (a === '--first-run') args.firstRun = Number(argv[(i += 1)]);
    else if (a === '--out') args.out = argv[(i += 1)];
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!args.manifest) {
    console.error('--manifest is required');
    process.exit(2);
  }
  if (!Number.isInteger(args.cursor) || args.cursor < 0) {
    console.error(`invalid --cursor: ${args.cursor}`);
    process.exit(2);
  }
  // Guard against human-format sizes like "100k": Number('100k') is NaN and
  // a NaN budget would silently plan the entire remaining manifest.
  for (const key of ['lines', 'groupLines', 'groupFiles']) {
    if (!Number.isInteger(args[key]) || args[key] <= 0) {
      console.error(
        `invalid --${ARG_NAME_BY_KEY[key]}: must be a positive integer (convert "100k" to 100000 first)`,
      );
      process.exit(2);
    }
  }
  if (args.doneIndices.some((n) => !Number.isInteger(n) || n < 0)) {
    console.error(
      'invalid --done-indices: must be comma-separated non-negative integers',
    );
    process.exit(2);
  }
  if (!Number.isInteger(args.firstRun) || args.firstRun <= 0) {
    console.error(`invalid --first-run: ${args.firstRun}`);
    process.exit(2);
  }
  if (args.planRuns && (args.doneIndices.length > 0 || args.preserveGroupIds)) {
    console.error(
      '--plan-runs plans a whole batch; it cannot be combined with --done-indices/--preserve-group-ids',
    );
    process.exit(2);
  }
  return args;
}

function planRuns({ args, entries }) {
  // Boundary rule MUST mirror buildGroups: files keep being added while the
  // accumulated line count is still below the budget, so the file that
  // crosses the budget is INCLUDED and the run ends after it. This identity
  // is what lets `--cursor <start> --lines <runLines>` reproduce each run at
  // execution time.
  const runs = [];
  let start = args.cursor;
  let r = args.firstRun;
  while (start < entries.length) {
    let planned = 0;
    let i = start;
    while (i < entries.length && planned < args.lines) {
      const e = entries[i];
      if (e.i !== i) {
        console.error(`manifest corrupt: entry at position ${i} has i=${e.i}`);
        process.exit(2);
      }
      planned += e.lines;
      i += 1;
    }
    runs.push({ r, start, end: i, files: i - start, lines: planned });
    start = i;
    r += 1;
  }
  return runs;
}

function buildGroups({ args, entries, done, skipDone }) {
  const groups = [];
  let current = { files: [], totalLines: 0 };
  let plannedLines = 0;
  let lastIndex = args.cursor - 1;

  const flush = () => {
    if (current.files.length > 0) {
      groups.push({
        id: groups.length + 1,
        files: current.files,
        totalFiles: current.files.length,
        totalLines: current.totalLines,
      });
      current = { files: [], totalLines: 0 };
    }
  };

  for (let i = args.cursor; i < entries.length; i += 1) {
    if (plannedLines >= args.lines) break;
    if (skipDone && done.has(i)) {
      lastIndex = i;
    } else {
      const e = entries[i];
      if (e.i !== i) {
        console.error(`manifest corrupt: entry at position ${i} has i=${e.i}`);
        process.exit(2);
      }
      if (
        current.files.length > 0 &&
        (current.totalLines + e.lines > args.groupLines ||
          current.files.length >= args.groupFiles)
      ) {
        flush();
      }
      current.files.push({ i, path: e.path, lines: e.lines });
      current.totalLines += e.lines;
      plannedLines += e.lines;
      lastIndex = i;
    }
  }
  flush();

  return { groups, plannedLines, lastIndex };
}

function attachReadProbes({ args, groups }) {
  // Attach read probes (requires --repo pointing at the pinned worktree).
  if (args.repo) {
    for (const g of groups) {
      for (const f of g.files) {
        if (f.lines > PROBE_MIN_FILE_LINES) {
          const ln = pickProbeLine(args.repo, f.path, f.lines);
          if (ln) f.probeLine = ln;
        }
      }
    }
  }
}

function sumLinesThrough(entries, proposedCursor) {
  let linesThroughProposedCursor = 0;
  for (let i = 0; i < proposedCursor; i += 1) {
    linesThroughProposedCursor += entries[i].lines;
  }
  return linesThroughProposedCursor;
}

function main() {
  const args = parseArgs(process.argv);
  const entries = readFileSync(args.manifest, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  if (args.planRuns) {
    const runs = planRuns({ args, entries });
    const table = {
      cursor: args.cursor,
      runLines: args.lines,
      firstRun: args.firstRun,
      runCount: runs.length,
      totalFilesInManifest: entries.length,
      totalLinesInManifest: entries.reduce((s, e) => s + e.lines, 0),
      runs,
    };
    if (args.out) writeFileSync(args.out, JSON.stringify(table, null, 1));
    console.log(JSON.stringify(table, null, 1));
    return;
  }

  const done = new Set(args.doneIndices);
  let groups;
  let plannedLines;
  let proposedCursor;
  let strandedDoneIndices;

  if (args.preserveGroupIds) {
    const original = buildGroups({ args, entries, done, skipDone: false });
    proposedCursor = original.lastIndex + 1;
    groups = original.groups
      .map((g) => {
        const files = g.files.filter((f) => !done.has(f.i));
        return {
          ...g,
          files,
          totalFiles: files.length,
          totalLines: files.reduce((sum, f) => sum + f.lines, 0),
        };
      })
      .filter((g) => g.files.length > 0);
    plannedLines = groups.reduce((sum, g) => sum + g.totalLines, 0);
    strandedDoneIndices = [...done]
      .filter((n) => n >= proposedCursor)
      .toSorted((a, b) => a - b);
  } else {
    const filled = buildGroups({ args, entries, done, skipDone: true });
    groups = filled.groups;
    plannedLines = filled.plannedLines;
    let lastIndex = filled.lastIndex;

    // Swallow trailing already-done files so they end up behind the cursor
    // instead of being replanned and scanned again by the next run.
    while (done.has(lastIndex + 1)) lastIndex += 1;

    proposedCursor = lastIndex + 1;
    // Done indices the budget did not reach: they stay ahead of the cursor and
    // WILL be replanned later. Surface them so the orchestrator can warn.
    strandedDoneIndices = [...done]
      .filter((n) => n >= proposedCursor)
      .toSorted((a, b) => a - b);
  }

  attachReadProbes({ args, groups });
  const linesThroughProposedCursor = sumLinesThrough(entries, proposedCursor);

  const plan = {
    cursor: args.cursor,
    resumeMode: args.preserveGroupIds ? 'preserve-group-ids' : 'fill-budget',
    // v6: assert proposedCursor == the table run's `end` (drift guard).
    proposedCursor,
    // Absolute covered-lines through proposedCursor (NOT an increment).
    linesThroughProposedCursor,
    strandedDoneIndices,
    totalFilesInManifest: entries.length,
    totalLinesInManifest: entries.reduce((s, e) => s + e.lines, 0),
    plannedFiles: groups.reduce((s, g) => s + g.totalFiles, 0),
    plannedLines,
    groupCount: groups.length,
    exhausted: proposedCursor >= entries.length,
    groups,
  };

  if (args.out) writeFileSync(args.out, JSON.stringify(plan, null, 1));

  const { groups: _omitted, ...summary } = plan;
  summary.groupSizes = groups.map(
    (g) => `${g.id}:${g.totalFiles}f/${g.totalLines}l`,
  );
  console.log(JSON.stringify(summary, null, 1));
}

main();
