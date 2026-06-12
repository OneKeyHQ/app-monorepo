#!/usr/bin/env node
// Test harness for coordinate.mjs — replays the failure timelines found by
// the two adversarial design reviews and asserts the engine resolves each
// one deterministically.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('./coordinate.mjs', import.meta.url).pathname;
const NOW = '2026-06-12T12:00:00Z';
const TMP_DIR = mkdtempSync(join(tmpdir(), '1k-cycle-scan-coordinate-'));
const tmp = (name) => join(TMP_DIR, name);
let passed = 0;
let failed = 0;

process.on('exit', () => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

function run(args, { expectFail = false } = {}) {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
    if (expectFail) return { failed: false, out };
    return JSON.parse(out);
  } catch (e) {
    if (expectFail) return { failed: true, stderr: String(e.stderr) };
    throw new Error(`unexpected failure: ${e.stderr}`);
  }
}

function check(name, cond, extra) {
  if (cond) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.log(`FAIL ${name}${extra ? ` — ${JSON.stringify(extra)}` : ''}`); }
}

const C = (kind, dim, b, r, g, json, createdAt, human = '') => ({
  body: `[1k-cycle-scan:${kind}:${dim}:${b}${r != null ? `:${r}` : ''}${g != null ? `:${g}` : ''}]\n\`\`\`json\n${JSON.stringify(json)}\n\`\`\`\n${human}`,
  createdAt,
});
const dump = (path, comments) => writeFileSync(path, JSON.stringify(comments));
const manifestPath = tmp('test-manifest.jsonl');
const manifestRunFixture = [
  { files: 40, lines: 50_008 },
  { files: 43, lines: 50_193 },
  { files: 43, lines: 50_860 },
  { files: 45, lines: 50_315 },
  { files: 40, lines: 50_224 },
  { files: 48, lines: 52_237 },
  { files: 43, lines: 50_551 },
  { files: 42, lines: 50_146 },
  { files: 40, lines: 50_265 },
  { files: 38, lines: 50_656 },
  { files: 37, lines: 51_358 },
  { files: 42, lines: 50_093 },
  { files: 35, lines: 50_740 },
  { files: 1, lines: 1_922 },
];

function buildManifestEntries() {
  const entries = [];
  for (const runInfo of manifestRunFixture) {
    if (runInfo.files === 1) {
      entries.push(runInfo.lines);
      continue;
    }
    const base = Math.floor(49_000 / (runInfo.files - 1));
    const leadLines = base * (runInfo.files - 1);
    for (let i = 0; i < runInfo.files - 1; i += 1) entries.push(base);
    entries.push(runInfo.lines - leadLines);
  }
  return entries.map((lines, i) => ({ i, path: `pkg/f${i}.ts`, lines }));
}

writeFileSync(
  manifestPath,
  `${buildManifestEntries().map((entry) => JSON.stringify(entry)).join('\n')}\n`,
);

// ---- 1. empty run page → scan
dump(tmp('t1.json'), []);
let s = run(['--op', 'run-status', '--comments', tmp('t1.json'), '--now', NOW]);
check('1 empty → pickable=scan', s.pickable === 'scan');

// ---- 2. live claim → none, staleAt reported
dump(tmp('t2.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:30:00Z' }, '2026-06-12T11:30:00Z'),
  C('ckpt', 'perf', 2, 5, 1, { g: 1, idx: [100, 101], lines: 3000, nonce: 'aaaa1111', f: [] }, '2026-06-12T11:50:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t2.json'), '--now', NOW]);
check('2 live owner → none', s.pickable === 'none' && s.staleAt === '2026-06-12T13:50:00.000Z', s);

// ---- 3. stale claim → takeover; doneIndices + originalClaim params
dump(tmp('t3.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 3000, groupFiles: 20, focus: '启动路径', at: '2026-06-12T08:00:00Z' }, '2026-06-12T08:00:00Z'),
  C('ckpt', 'perf', 2, 5, 1, { g: 1, idx: [100, 101], lines: 3000, nonce: 'aaaa1111', f: [{ p: 'a.ts', l: 1, cat: 'x', sev: 'P1', t: 't', conf: 0.9 }] }, '2026-06-12T08:30:00Z'),
  C('ckpt', 'perf', 2, 5, 2, { g: 2, idx: [102], lines: 2000, nonce: 'aaaa1111', f: [] }, '2026-06-12T09:00:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t3.json'), '--now', NOW]);
check('3 stale → takeover, done idx, original params', s.pickable === 'takeover'
  && JSON.stringify(s.doneIndices) === '[100,101,102]'
  && s.originalClaim.groupLines === 3000 && s.originalClaim.focus === '启动路径'
  && s.findings.length === 1, s);

// ---- 4. same-second race → smaller nonce owns; loser knows it lost
dump(tmp('t4.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'bbbb2222', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:00:00Z' }, '2026-06-12T11:00:00Z'),
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:00:00Z' }, '2026-06-12T11:00:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t4.json'), '--now', NOW, '--my-nonce', 'bbbb2222']);
check('4 same-second race → smaller nonce wins, my bbbb lost', s.owner.nonce === 'aaaa1111' && s.ownedByMe === false, s);

// ---- 5. complete close → terminal: never pickable, takeover claim never owns, slackDedup
dump(tmp('t5.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T06:00:00Z' }, '2026-06-12T06:00:00Z'),
  C('close', 'perf', 2, 5, null, { nonce: 'aaaa1111', missingIdx: [], waivedIdx: [], lines: 50214, at: '2026-06-12T07:00:00Z' }, '2026-06-12T07:00:00Z'),
  C('claim', 'perf', 2, 5, null, { nonce: 'cccc3333', mode: 'takeover', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:00:00Z' }, '2026-06-12T11:00:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t5.json'), '--now', NOW, '--my-nonce', 'cccc3333']);
check('5 complete close terminal → none, late claim never owns, dedup', s.pickable === 'none'
  && s.owner.nonce === 'aaaa1111' && s.ownedByMe === false
  && s.closed.complete === true && s.slackDedup === true, s);

// ---- 6. incomplete close → repair; second close same missingIdx → breaker
dump(tmp('t6a.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T06:00:00Z' }, '2026-06-12T06:00:00Z'),
  C('close', 'perf', 2, 5, null, { nonce: 'aaaa1111', missingIdx: [107, 108], waivedIdx: [], lines: 41000, at: '2026-06-12T07:00:00Z' }, '2026-06-12T07:00:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t6a.json'), '--now', NOW]);
check('6a incomplete close → repair immediately', s.pickable === 'repair' && s.repairBreaker === false, s);

dump(tmp('t6b.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T06:00:00Z' }, '2026-06-12T06:00:00Z'),
  C('close', 'perf', 2, 5, null, { nonce: 'aaaa1111', missingIdx: [107, 108], waivedIdx: [], lines: 41000, at: '2026-06-12T07:00:00Z' }, '2026-06-12T07:00:00Z'),
  C('claim', 'perf', 2, 5, null, { nonce: 'dddd4444', mode: 'repair', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T07:30:00Z' }, '2026-06-12T07:30:00Z'),
  C('close', 'perf', 2, 5, null, { nonce: 'dddd4444', missingIdx: [108, 107], waivedIdx: [], lines: 41000, at: '2026-06-12T08:30:00Z' }, '2026-06-12T08:30:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t6b.json'), '--now', NOW]);
check('6b same missingIdx twice → circuit breaker', s.pickable === 'none' && s.repairBreaker === true
  && s.pickableReason.includes('waiver'), s);

// ---- 7. waiver close → terminal complete with waived surfaced
dump(tmp('t7.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'eeee5555', mode: 'repair', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T09:00:00Z' }, '2026-06-12T09:00:00Z'),
  C('close', 'perf', 2, 5, null, { nonce: 'eeee5555', missingIdx: [], waivedIdx: [107], lines: 41000, at: '2026-06-12T10:00:00Z' }, '2026-06-12T10:00:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t7.json'), '--now', NOW]);
check('7 waiver close → terminal, waived listed', s.pickable === 'none' && s.closed.complete === true
  && JSON.stringify(s.closed.waivedIdx) === '[107]', s);

// ---- 8. voided run → immediately claimable (no 2h freeze); void breaker on repeat reason
dump(tmp('t8a.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:40:00Z' }, '2026-06-12T11:40:00Z'),
  C('void', 'perf', 2, 5, null, { nonce: 'aaaa1111', reason: 'lost race', at: '2026-06-12T11:41:00Z' }, '2026-06-12T11:41:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t8a.json'), '--now', NOW]);
check('8a voided → immediately claimable', s.pickable === 'voided', s);

dump(tmp('t8b.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T10:00:00Z' }, '2026-06-12T10:00:00Z'),
  C('void', 'perf', 2, 5, null, { nonce: 'aaaa1111', reason: 'proposedCursor != run.end', at: '2026-06-12T10:01:00Z' }, '2026-06-12T10:01:00Z'),
  C('claim', 'perf', 2, 5, null, { nonce: 'bbbb2222', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:00:00Z' }, '2026-06-12T11:00:00Z'),
  C('void', 'perf', 2, 5, null, { nonce: 'bbbb2222', reason: 'proposedCursor != run.end', at: '2026-06-12T11:01:00Z' }, '2026-06-12T11:01:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t8b.json'), '--now', NOW]);
check('8b two voids same reason → breaker (systemic failure)', s.pickable === 'none' && s.voidBreaker === true, s);

// ---- 9. takeover then original runner wakes: fold gives ownership to taker
dump(tmp('t9.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T05:00:00Z' }, '2026-06-12T05:00:00Z'),
  C('ckpt', 'perf', 2, 5, 1, { g: 1, idx: [100], lines: 1000, nonce: 'aaaa1111', f: [] }, '2026-06-12T05:10:00Z'),
  // 2h+ silence → ffff6666 takes over
  C('claim', 'perf', 2, 5, null, { nonce: 'ffff6666', mode: 'takeover', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T07:30:00Z' }, '2026-06-12T07:30:00Z'),
  // original runner wakes and posts a late checkpoint (nonce-tagged)
  C('ckpt', 'perf', 2, 5, 2, { g: 2, idx: [101], lines: 1200, nonce: 'aaaa1111', f: [] }, '2026-06-12T08:00:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t9.json'), '--now', NOW, '--my-nonce', 'aaaa1111']);
check('9 woken original runner sees it lost ownership', s.owner.nonce === 'ffff6666' && s.ownedByMe === false
  && JSON.stringify(s.doneIndices) === '[100,101]', s);

// ---- 10. invalid takeover (owner still live) never owns
dump(tmp('t10.json'), [
  C('claim', 'perf', 2, 5, null, { nonce: 'aaaa1111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:00:00Z' }, '2026-06-12T11:00:00Z'),
  C('claim', 'perf', 2, 5, null, { nonce: 'gggg7777', mode: 'takeover', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:30:00Z' }, '2026-06-12T11:30:00Z'),
]);
s = run(['--op', 'run-status', '--comments', tmp('t10.json'), '--now', NOW, '--my-nonce', 'gggg7777']);
check('10 takeover against live owner never owns', s.owner.nonce === 'aaaa1111' && s.ownedByMe === false, s);

// ---- 11. malformed protocol comment → fail-closed
dump(tmp('t11.json'), [
  { body: '[1k-cycle-scan:claim:perf:2:5]\n```json\n{ broken', createdAt: '2026-06-12T11:00:00Z' },
]);
let r = run(['--op', 'run-status', '--comments', tmp('t11.json'), '--now', NOW], { expectFail: true });
check('11 unparseable payload → fail-closed', r.failed === true && r.stderr.includes('fail-closed'));

// ---- 12. entity-escaped payload still parses
dump(tmp('t12.json'), [
  { body: '[1k-cycle-scan:claim:perf:2:5]\n```json\n{&quot;nonce&quot;:&quot;aaaa1111&quot;,&quot;mode&quot;:&quot;scan&quot;,&quot;groupLines&quot;:4000,&quot;groupFiles&quot;:25,&quot;focus&quot;:null,&quot;at&quot;:&quot;2026-06-12T11:00:00Z&quot;}\n```', createdAt: '2026-06-12T11:00:00Z' },
]);
s = run(['--op', 'run-status', '--comments', tmp('t12.json'), '--now', NOW]);
check('12 entity-escaped JSON unescaped and parsed', s.owner?.nonce === 'aaaa1111', s);

// ---- 13. make-comment round trip
const made = run(['--op', 'make-comment', '--kind', 'claim', '--dim', 'perf', '--batch', '2', '--run', '5',
  '--nonce', 'aaaa1111', '--mode', 'scan', '--group-lines', '4000', '--group-files', '25', '--at', '2026-06-12T11:00:00Z']);
dump(tmp('t13.json'), [{ body: made.body, createdAt: '2026-06-12T11:00:00Z' }]);
s = run(['--op', 'run-status', '--comments', tmp('t13.json'), '--now', NOW]);
check('13 make-comment(claim) round-trips through the parser', s.owner?.nonce === 'aaaa1111' && s.pickable === 'none', s);

// ---- 14. pick-order: fence stops everything; closed runs excluded; shuffle deterministic
const table = { runLines: 50000, firstRun: 1, runs: [
  { r: 1, start: 0, end: 40, files: 40, lines: 50008, pageId: 'p1' },
  { r: 2, start: 40, end: 83, files: 43, lines: 50193, pageId: 'p2' },
  { r: 3, start: 83, end: 126, files: 43, lines: 50860, pageId: 'p3' },
  { r: 4, start: 126, end: 171, files: 45, lines: 50315, pageId: 'p4' },
] };
writeFileSync(tmp('t-table.json'), JSON.stringify(table));
dump(tmp('t14-idx.json'), [
  C('run-closed', 'perf', 2, 1, null, { missingIdx: [], lines: 50008 }, '2026-06-12T09:00:00Z'),
  C('run-closed', 'perf', 2, 3, null, { missingIdx: [90], lines: 48000 }, '2026-06-12T10:00:00Z'),
]);
s = run(['--op', 'pick-order', '--table', tmp('t-table.json'), '--index', tmp('t14-idx.json'), '--nonce', 'aaaa1111', '--total-lines', '201376']);
const s2 = run(['--op', 'pick-order', '--table', tmp('t-table.json'), '--index', tmp('t14-idx.json'), '--nonce', 'aaaa1111', '--total-lines', '201376']);
const rs = s.candidates.map((c) => c.r);
check('14a pick-order: closed excluded, repair listed, deterministic', !rs.includes(1) && rs.includes(3)
  && s.candidates.find((c) => c.r === 3).hint === 'repair'
  && JSON.stringify(s) === JSON.stringify(s2)
  && s.progress.closedRuns === 1 && s.progress.coveredLines === 50008, s);
const sB = run(['--op', 'pick-order', '--table', tmp('t-table.json'), '--index', tmp('t14-idx.json'), '--nonce', 'zzzz9999']);
check('14b different nonce → (possibly) different probe order, same candidate set',
  JSON.stringify([...sB.candidates.map((c) => c.r)].sort()) === JSON.stringify([...rs].sort()));

dump(tmp('t14-fenced.json'), [
  C('batch-closed', 'perf', 2, null, null, { reason: 'forcedRebuild', at: '2026-06-12T11:00:00Z' }, '2026-06-12T11:00:00Z'),
]);
s = run(['--op', 'pick-order', '--table', tmp('t-table.json'), '--index', tmp('t14-fenced.json'), '--nonce', 'aaaa1111']);
check('14c fenced batch → hard stop instruction', s.fence !== null && s.instruction.includes('FENCED'), s);

// ---- 15. batch-status authoritative gate
mkdirSync(tmp('t15-runs'), { recursive: true });
const completeRun = (r, nonce) => [
  C('claim', 'perf', 2, r, null, { nonce, mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T06:00:00Z' }, '2026-06-12T06:00:00Z'),
  C('close', 'perf', 2, r, null, { nonce, missingIdx: [], waivedIdx: [], lines: 50000, at: '2026-06-12T07:00:00Z' }, '2026-06-12T07:00:00Z'),
];
dump(tmp('t15-runs/r001.json'), completeRun(1, 'a1'));
dump(tmp('t15-runs/r002.json'), completeRun(2, 'a2'));
dump(tmp('t15-runs/r003.json'), [
  C('claim', 'perf', 2, 3, null, { nonce: 'a3', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T06:00:00Z' }, '2026-06-12T06:00:00Z'),
  C('close', 'perf', 2, 3, null, { nonce: 'a3', missingIdx: [90], waivedIdx: [], lines: 48000, at: '2026-06-12T07:00:00Z' }, '2026-06-12T07:00:00Z'),
]);
dump(tmp('t15-runs/r004.json'), completeRun(4, 'a4'));
s = run(['--op', 'batch-status', '--table', tmp('t-table.json'), '--runs-dir', tmp('t15-runs'), '--now', NOW]);
check('15a gate blocks on incomplete run 3', s.complete === false && s.openRuns.length === 1 && s.openRuns[0].r === 3, s);
dump(tmp('t15-runs/r003.json'), [
  ...completeRun(3, 'a3').slice(0, 1),
  C('close', 'perf', 2, 3, null, { nonce: 'a3', missingIdx: [], waivedIdx: [90], lines: 48000, at: '2026-06-12T07:00:00Z' }, '2026-06-12T07:00:00Z'),
]);
s = run(['--op', 'batch-status', '--table', tmp('t-table.json'), '--runs-dir', tmp('t15-runs'), '--now', NOW]);
check('15b waiver unblocks gate, waived surfaced', s.complete === true && s.waived.length === 1
  && s.progress.closedRuns === 4, s);

// ---- 16. state transitions: init → lock → open-batch; guards
const init = run(['--op', 'state', '--transition', 'init', '--dimension', 'perf', '--rules-source', 'references/perf-rules.md', '--now', NOW]);
check('16a init produces full v6 idle state', init.state.v === 6 && init.state.batch === 0 && init.state.status === 'idle'
  && Object.keys(init.state).length === 20, init.state);
writeFileSync(tmp('t16-state.json'), JSON.stringify(init.state));
const locked = run(['--op', 'state', '--transition', 'lock', '--state', tmp('t16-state.json'), '--flow', 'opening', '--nonce', 'n1', '--now', NOW]);
check('16b lock sets status+nonce', locked.state.status === 'opening' && locked.state.runnerNonce === 'n1');
writeFileSync(tmp('t16-locked.json'), JSON.stringify(locked.state));
r = run(['--op', 'state', '--transition', 'lock', '--state', tmp('t16-locked.json'), '--flow', 'summarizing', '--nonce', 'n2', '--now', NOW], { expectFail: true });
check('16c second lock while held → refused', r.failed === true && r.stderr.includes('cannot lock'));
const opened = run(['--op', 'state', '--transition', 'open-batch', '--state', tmp('t16-locked.json'),
  '--batch-page-id', 'B1PAGE', '--pin', 'deadbeef', '--manifest-hash', 'mh', '--rules-hash', 'rh',
  '--total-files', '537', '--total-lines', '659568', '--run-count', '14', '--run-lines', '50000', '--now', NOW]);
check('16d open-batch increments batch, rolls prev*, unlocks', opened.state.batch === 1
  && opened.state.batchPageId === 'B1PAGE' && opened.state.status === 'idle' && opened.state.summaryPageId === null);
// version guard: v5 state refused
writeFileSync(tmp('t16-v5.json'), JSON.stringify({ ...init.state, v: 5 }));
r = run(['--op', 'state', '--transition', 'lock', '--state', tmp('t16-v5.json'), '--flow', 'opening', '--nonce', 'n3', '--now', NOW], { expectFail: true });
check('16e v5 state → version guard refuses', r.failed === true && r.stderr.includes('version guard'));

// ---- 17. retrofit transition from v5
writeFileSync(tmp('t17-v5.json'), JSON.stringify({
  v: 5, dimension: 'perf', status: 'idle', runnerNonce: null, batch: 2, batchPageId: 'B2',
  run: 7, runIncomplete: false, pinnedCommit: 'p', manifestHash: 'mh', rulesHash: 'rh',
  overrides: null, rulesSource: 'references/perf-rules.md', totalFiles: 537, totalLines: 659568,
  cursor: 126, scannedLines: 151061, summaryPageId: null, prevBatchPageId: null,
  prevSummaryPageId: null, updatedAt: '2026-06-11T00:00:00Z',
}));
writeFileSync(tmp('t17-table.json'), JSON.stringify({ runLines: 50000, firstRun: 8, runs: table.runs.slice(2).map((x, i) => ({ ...x, r: 8 + i })) }));
const retro = run(['--op', 'state', '--transition', 'retrofit', '--state', tmp('t17-v5.json'), '--table', tmp('t17-table.json'), '--now', NOW]);
check('17 retrofit: legacyCursor, runCount=v5.run+table, v6', retro.state.v === 6
  && retro.state.legacyCursor === 126 && retro.state.runCount === 9 && retro.state.status === 'idle', retro.state);

// ---- 18. route
writeFileSync(tmp('t18-state.json'), JSON.stringify(opened.state));
s = run(['--op', 'route', '--state', tmp('t18-state.json'), '--subcommand', 'status']);
check('18a status → Flow A', s.flow === 'A');
s = run(['--op', 'route', '--state', tmp('t18-state.json')]);
check('18b open batch without index → Flow D', s.flow === 'D');
dump(tmp('t18-idx.json'), table.runs.map((x) => C('run-closed', 'perf', 1, x.r, null, { missingIdx: [], lines: x.lines }, '2026-06-12T09:00:00Z')));
s = run(['--op', 'route', '--state', tmp('t18-state.json'), '--index', tmp('t18-idx.json'), '--table', tmp('t-table.json')]);
check('18c all runs closed, no summary → Flow E', s.flow === 'E', s);
writeFileSync(tmp('t18-state2.json'), JSON.stringify({ ...opened.state, summaryPageId: 'SUM' }));
s = run(['--op', 'route', '--state', tmp('t18-state2.json'), '--index', tmp('t18-idx.json'), '--table', tmp('t-table.json')]);
check('18d all closed + summary → Flow C', s.flow === 'C', s);
writeFileSync(tmp('t18-v5.json'), JSON.stringify({ v: 5, batch: 1 }));
s = run(['--op', 'route', '--state', tmp('t18-v5.json')]);
check('18e v5 → retrofit', s.flow === 'retrofit');


// ---- 19. plan-run: scripted hash + boundary gate
// build a real table from the synthetic manifest, plus a matching state
const realTable = JSON.parse(execFileSync('node',
  [new URL('./chunk.mjs', import.meta.url).pathname, '--manifest', tmp('test-manifest.jsonl'), '--cursor', '0', '--lines', '50000', '--plan-runs'],
  { encoding: 'utf8' }));
writeFileSync(tmp('t19-table.json'), JSON.stringify(realTable));
writeFileSync(tmp('t19-msum.json'), JSON.stringify({ commit: 'c1', manifestHash: 'm1', rulesHash: 'r1' }));
const baseState = run(['--op', 'state', '--transition', 'init', '--dimension', 'perf', '--now', NOW]).state;
writeFileSync(tmp('t19-state.json'), JSON.stringify({
  ...baseState, batch: 1, batchPageId: 'B', pinnedCommit: 'c1', manifestHash: 'm1', rulesHash: 'r1',
  totalFiles: 537, totalLines: 659568, runCount: realTable.runCount, runLines: 50000,
}));
s = run(['--op', 'plan-run', '--manifest', tmp('test-manifest.jsonl'), '--manifest-summary', tmp('t19-msum.json'),
  '--state', tmp('t19-state.json'), '--table', tmp('t19-table.json'), '--run', '2',
  '--group-lines', '4000', '--group-files', '25', '--out', tmp('t19-groups.json')]);
check('19a plan-run ok: boundary asserted, groups written', s.ok === true && s.run.start === 40 && s.run.end === 83
  && JSON.parse(readFileSync(tmp('t19-groups.json'))).groups.length === s.groupCount, s);
writeFileSync(tmp('t19-msum-bad.json'), JSON.stringify({ commit: 'c1', manifestHash: 'DRIFTED', rulesHash: 'r1' }));
r = run(['--op', 'plan-run', '--manifest', tmp('test-manifest.jsonl'), '--manifest-summary', tmp('t19-msum-bad.json'),
  '--state', tmp('t19-state.json'), '--table', tmp('t19-table.json'), '--run', '2',
  '--group-lines', '4000', '--group-files', '25', '--out', tmp('t19-g2.json')], { expectFail: true });
check('19b plan-run refuses hash drift', r.failed === true && r.stderr.includes('manifestHash'));
const drifted = { ...realTable, runs: realTable.runs.map((x) => x.r === 2 ? { ...x, end: x.end + 1 } : x) };
writeFileSync(tmp('t19-table-bad.json'), JSON.stringify(drifted));
r = run(['--op', 'plan-run', '--manifest', tmp('test-manifest.jsonl'), '--manifest-summary', tmp('t19-msum.json'),
  '--state', tmp('t19-state.json'), '--table', tmp('t19-table-bad.json'), '--run', '2',
  '--group-lines', '4000', '--group-files', '25', '--out', tmp('t19-g3.json')], { expectFail: true });
check('19c plan-run refuses table boundary drift', r.failed === true && r.stderr.includes('proposedCursor'));

// ---- 20. reconcile: coverage gaps → actions → close args
const planR2 = JSON.parse(readFileSync(tmp('t19-groups.json')));
const g1 = planR2.groups[0], g2 = planR2.groups[1];
const ckptFor = (g, t) => C('ckpt', 'perf', 1, 2, g.id,
  { g: g.id, idx: g.files.map((x) => x.i), lines: g.totalLines, nonce: 'me111111', f: [{ p: 'a.ts', l: 1, cat: 'sync-storage-io', sev: 'P1', t: '示例发现', conf: 0.9 }] }, t);
dump(tmp('t20.json'), [
  C('claim', 'perf', 1, 2, null, { nonce: 'me111111', mode: 'scan', groupLines: 4000, groupFiles: 25, focus: null, at: '2026-06-12T11:00:00Z' }, '2026-06-12T11:00:00Z'),
  ckptFor(g1, '2026-06-12T11:10:00Z'),
]);
s = run(['--op', 'reconcile', '--plan', tmp('t19-groups.json'), '--comments', tmp('t20.json'),
  '--my-nonce', 'me111111', '--table', tmp('t19-table.json'), '--run', '2', '--have-results', String(g2.id), '--now', NOW]);
const a1 = s.groups.find((x) => x.id === g1.id), a2 = s.groups.find((x) => x.id === g2.id);
const expectLines = realTable.runs[1].lines - planR2.groups.filter((g) => g.id !== g1.id).flatMap((g) => g.files).reduce((t, x) => t + x.lines, 0);
check('20a reconcile: covered/repost/rerun + close args', s.takenOver === false
  && a1.covered === true && a1.action === null && a2.action === 'repost-checkpoint'
  && s.groups.filter((x) => x.action === 'rerun-once').length === planR2.groups.length - 2
  && s.actionsPending === true && s.closeArgs.lines === expectLines, s);
s = run(['--op', 'reconcile', '--plan', tmp('t19-groups.json'), '--comments', tmp('t20.json'),
  '--my-nonce', 'other999', '--table', tmp('t19-table.json'), '--run', '2', '--now', NOW]);
check('20b reconcile: non-owner → takenOver, stop', s.takenOver === true);

// ---- 21. make-report: full body generated from checkpoints
s = run(['--op', 'make-report', '--comments', tmp('t20.json'), '--state', tmp('t19-state.json'),
  '--table', tmp('t19-table.json'), '--run', '2', '--mode', 'scan', '--nonce', 'me111111',
  '--plan', tmp('t19-groups.json'), '--refuted', '1', '--closed-runs', '3', '--run-count', '14',
  '--missing-idx', '60,61', '--now', NOW]);
check('21 make-report renders header/sections/stats', s.body.includes('| 日期 / commit | 2026-06-12 / `c1` |')
  && s.body.includes('manifest [40, 83)') && s.body.includes('示例发现')
  && s.body.includes('| sync-storage-io | 0 | 1 | 0 |') && s.body.includes('已关 3/14')
  && s.body.includes('缺 2 个文件'), s.body.split('\n').slice(0, 10));

// ---- 22. slack lines generated, never hand-written
s = run(['--op', 'make-comment', '--kind', 'slack-run', '--dim', 'perf', '--batch', '2', '--run', '5',
  '--range', '250,300', '--p0', '1', '--p1', '4', '--p2', '7', '--closed-runs', '8', '--run-count', '19',
  '--url', 'https://x.example/r5']);
check('22a slack-run line', s.body === 'perf · B002 R005 完成 · 范围 [250,300) · P0×1 P1×4 P2×7 · 已关 8/19 · https://x.example/r5', s);
s = run(['--op', 'make-comment', '--kind', 'slack-run', '--dim', 'perf', '--batch', '2', '--run', '5',
  '--range', '250,300', '--missing-idx', '260,261', '--closed-runs', '8', '--run-count', '19', '--url', 'u']);
check('22b slack-run partial wording', s.body.includes('部分完成 · 缺 2 文件'), s);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
