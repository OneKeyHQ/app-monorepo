#!/usr/bin/env node
/**
 * 1k-cycle-scan slice planner.
 *
 * Takes the deterministic manifest plus the persisted cursor and emits the
 * next slice of files, pre-grouped into line-balanced agent workloads.
 *
 * Resume semantics: the cursor only advances when an entire run completes.
 * If a previous run died mid-way, pass the file indices already covered by
 * its checkpoint replies via --done-indices; those files are skipped and the
 * remainder of the interrupted slice is planned first.
 *
 * Usage:
 *   node chunk.mjs --manifest /tmp/manifest.jsonl --cursor 0
 *                  [--lines 50000] [--group-lines 4000] [--group-files 25]
 *                  [--done-indices "12,13,40"] [--out /tmp/groups.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Defaults calibrated 2026-06: ~50k lines per run keeps a full batch around
// 20 runs; ~4000 lines (or 25 files) per group fits one deep-reading agent.
const DEFAULTS = { lines: 50_000, groupLines: 4_000, groupFiles: 25 };

// Read probes: the agent Read tool returns at most ~2000 lines per call, so
// only files beyond that can be silently truncated by a lazy reader. For such
// files we pick a deep line whose CONTENT the scan agent must echo back; the
// orchestrator verifies it against the worktree. Position is deterministic —
// the content is the secret, so determinism does not weaken the check.
const PROBE_MIN_FILE_LINES = 1800;
const PROBE_MIN_CHARS = 12;

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
  const args = { ...DEFAULTS, cursor: 0, doneIndices: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--manifest') args.manifest = argv[(i += 1)];
    else if (a === '--repo') args.repo = argv[(i += 1)];
    else if (a === '--cursor') args.cursor = Number(argv[(i += 1)]);
    else if (a === '--lines') args.lines = Number(argv[(i += 1)]);
    else if (a === '--group-lines') args.groupLines = Number(argv[(i += 1)]);
    else if (a === '--group-files') args.groupFiles = Number(argv[(i += 1)]);
    else if (a === '--done-indices') {
      args.doneIndices = argv[(i += 1)]
        .split(',')
        .filter(Boolean)
        .map(Number);
    } else if (a === '--out') args.out = argv[(i += 1)];
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
      console.error(`invalid --${key === 'lines' ? 'lines' : key === 'groupLines' ? 'group-lines' : 'group-files'}: must be a positive integer (convert "100k" to 100000 first)`);
      process.exit(2);
    }
  }
  if (args.doneIndices.some((n) => !Number.isInteger(n) || n < 0)) {
    console.error('invalid --done-indices: must be comma-separated non-negative integers');
    process.exit(2);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const entries = readFileSync(args.manifest, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const done = new Set(args.doneIndices);
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
    if (done.has(i)) {
      lastIndex = i;
      continue;
    }
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
  flush();

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

  // Swallow trailing already-done files so they end up behind the cursor
  // instead of being replanned (and rescanned) by the next run.
  while (done.has(lastIndex + 1)) lastIndex += 1;

  const proposedCursor = lastIndex + 1;
  // Done indices the budget did not reach: they stay ahead of the cursor and
  // WILL be replanned later. Surface them so the orchestrator can warn.
  const strandedDoneIndices = [...done].filter((n) => n >= proposedCursor).sort((a, b) => a - b);
  let linesThroughProposedCursor = 0;
  for (let i = 0; i < proposedCursor; i += 1) linesThroughProposedCursor += entries[i].lines;

  const plan = {
    cursor: args.cursor,
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
  summary.groupSizes = groups.map((g) => `${g.id}:${g.totalFiles}f/${g.totalLines}l`);
  console.log(JSON.stringify(summary, null, 1));
}

main();
