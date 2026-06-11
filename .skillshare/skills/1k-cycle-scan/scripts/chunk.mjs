#!/usr/bin/env node
/**
 * 1k-cycle-scan slice planner.
 *
 * Takes the deterministic manifest plus the persisted cursor and emits the
 * next slice of files, pre-grouped into line-balanced agent workloads.
 *
 * Resume semantics: the cursor only advances when an entire run completes.
 * If a previous run died mid-way, pass the file indices already covered by
 * its checkpoint replies via --done-indices. With --preserve-group-ids, the
 * original interrupted slice is reconstructed and only missing original group
 * IDs are emitted. Without it, done files are skipped and the remaining budget
 * is filled from later manifest entries.
 *
 * Usage:
 *   node chunk.mjs --manifest /tmp/manifest.jsonl --cursor 0
 *                  [--lines 50000] [--group-lines 4000] [--group-files 25]
 *                  [--done-indices "12,13,40"] [--preserve-group-ids]
 *                  [--out /tmp/groups.json]
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
  return args;
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
    // Cursor value to persist once EVERY group below has a checkpoint.
    proposedCursor,
    // Absolute covered-lines value for the state message (NOT an increment):
    // sum of all manifest lines below proposedCursor. Crash-recovery safe.
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
