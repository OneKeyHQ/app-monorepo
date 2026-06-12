#!/usr/bin/env node
/**
 * 1k-cycle-scan coordination engine.
 *
 * ALL protocol decisions live here, not in the model: claim ownership fold,
 * pickability, staleness, repair/void circuit breakers, Slack dedup, batch
 * completeness, progress math, comment-body generation, state JSON
 * transitions, and flow routing. The orchestrating model only does I/O:
 * dump Confluence comments/pages to JSON files, run an op, execute the
 * returned instructions verbatim. If a model conclusion ever disagrees with
 * an op output, the op output wins.
 *
 * Comment dump format (from getConfluencePageFooterComments, ALL pages —
 * paginate to exhaustion): JSON array of { "body": string, "createdAt": ISO
 * string } (extra fields ignored; "created-date"/"createdDate" accepted).
 *
 * Ops:
 *   --op run-status   --comments run.json [--my-nonce ab12cd34]
 *                     [--now ISO] [--stale-minutes 120]
 *       → ownership fold + pickability for ONE run page.
 *   --op pick-order   --table runs.json --index batch-comments.json
 *                     --nonce ab12cd34 [--legacy-run 0] [--legacy-cursor 0]
 *                     [--total-lines N]
 *       → fence check, candidate probe order, progress (advisory, from index).
 *   --op batch-status --table runs.json --runs-dir /tmp/dumps
 *                     [--legacy-run 0] [--legacy-cursor 0] [--total-lines N]
 *                     [--now ISO] [--stale-minutes 120]
 *       → authoritative completeness gate (reads r<NNN>.json per run).
 *   --op make-comment --kind claim|void|close|ckpt|run-closed|batch-closed
 *                     --dim perf --batch 2 [--run 5] [--group 3] …field flags…
 *       → exact comment body to post (marker + JSON + human line).
 *   --op state        --transition init|lock|unlock|open-batch|close-summary|retrofit
 *                     --state state.json …field flags…
 *       → validated new state JSON + versionMessage (version guard enforced).
 *   --op route        --state state.json [--index batch-comments.json]
 *                     [--subcommand scan|status|report|rebuild]
 *       → which flow handles this invocation.
 *
 * Every op prints a single JSON object to stdout; non-zero exit = the input
 * violates the protocol (message on stderr). Use --out to also write a file.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_STALE_MINUTES = 120;
const MARKER_RE = /\[1k-cycle-scan:(claim|ckpt|close|void|run-closed|batch-closed):([a-z0-9][a-z0-9-]*):(\d+)(?::(\d+))?(?::(\d+))?\]/;

// ---------------------------------------------------------------- utilities

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

function unescapeEntities(s) {
  return s
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function readJson(path, what) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`cannot read ${what} from ${path}: ${e.message}`);
  }
}

// Deterministic shuffle key so concurrent sessions probe candidates in
// different orders (djb2 over nonce:r).
function shuffleKey(nonce, r) {
  const s = `${nonce}:${r}`;
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

function isoOrFail(value, flag) {
  const t = Date.parse(value);
  if (Number.isNaN(t)) fail(`invalid ${flag}: ${value} (need ISO datetime)`);
  return t;
}

// Extract the first balanced {...} JSON object that appears after `from`.
function extractJsonAfter(text, from) {
  const start = text.indexOf('{', from);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// ------------------------------------------------------------ comment model

function parseComments(raw, what) {
  if (!Array.isArray(raw)) fail(`${what}: dump must be a JSON array of comments`);
  const events = [];
  const malformed = [];
  for (const c of raw) {
    const body = unescapeEntities(String(c.body ?? c.content ?? ''));
    const createdRaw = c.createdAt ?? c['created-date'] ?? c.createdDate;
    const createdAtMs = Date.parse(createdRaw ?? '');
    const m = body.match(MARKER_RE);
    if (!m) continue; // non-protocol comment: ignore
    if (Number.isNaN(createdAtMs)) {
      malformed.push({ reason: 'missing/invalid createdAt', marker: m[0] });
      continue;
    }
    const [, kind, dim, a, b, g] = m;
    const json = extractJsonAfter(body, body.indexOf(m[0]) + m[0].length);
    if (!json) {
      // Fail-closed: a protocol marker whose JSON cannot be parsed is an
      // active conflict, never something to skip silently.
      malformed.push({ reason: 'unparseable JSON payload', marker: m[0] });
      continue;
    }
    events.push({
      kind,
      dim,
      batch: Number(a),
      run: b === undefined ? null : Number(b),
      group: g === undefined ? null : Number(g),
      createdAtMs,
      createdAt: new Date(createdAtMs).toISOString(),
      json,
    });
  }
  events.sort((x, y) => x.createdAtMs - y.createdAtMs
    || String(x.json.nonce ?? '').localeCompare(String(y.json.nonce ?? '')));
  return { events, malformed };
}

// ------------------------------------------------------- ownership fold core

/**
 * Fold one run page's events into ownership + status. Deterministic: every
 * reader of the same dump gets the same answer; tombstones are courtesy,
 * never load-bearing.
 */
function foldRun({ events, nowMs, staleMs }) {
  const claims = events.filter((e) => e.kind === 'claim');
  const sameSet = (a, b) => JSON.stringify([...a].sort((x, y) => x - y))
    === JSON.stringify([...b].sort((x, y) => x - y));

  // State rebuilt as we walk claims in (createdAt, nonce) order.
  let owner = null; // { nonce, mode, claim }
  const ownershipLog = [];

  const eventsBefore = (ms) => events.filter((e) => e.createdAtMs < ms);

  const ownerHeartbeatMs = (own, evts) => {
    let hb = own.claim.createdAtMs;
    for (const e of evts) {
      if (e.kind === 'ckpt' && e.createdAtMs >= own.claim.createdAtMs) {
        // nonce-matched checkpoints always count; legacy ckpts without a
        // nonce count only while no later claim exists (conservative).
        const n = e.json.nonce;
        if (n === own.nonce || n === undefined) hb = Math.max(hb, e.createdAtMs);
      }
    }
    return hb;
  };

  const ownerClose = (own, evts) => evts.findLast(
    (e) => e.kind === 'close' && e.json.nonce === own.nonce
      && e.createdAtMs >= own.claim.createdAtMs,
  ) ?? null;

  const ownerVoid = (own, evts) => evts.findLast(
    (e) => e.kind === 'void' && e.json.nonce === own.nonce
      && e.createdAtMs >= own.claim.createdAtMs,
  ) ?? null;

  const terminalCloseIn = (evts) => evts.find(
    (e) => e.kind === 'close' && Array.isArray(e.json.missingIdx)
      && e.json.missingIdx.length === 0,
  ) ?? null;

  for (const claim of claims) {
    const prior = eventsBefore(claim.createdAtMs);
    if (terminalCloseIn(prior)) {
      ownershipLog.push({ nonce: claim.json.nonce, owns: false, why: 'run already completely closed' });
      continue;
    }
    if (!owner) {
      owner = { nonce: claim.json.nonce, mode: claim.json.mode, claim };
      ownershipLog.push({ nonce: claim.json.nonce, owns: true, why: 'first claim' });
      continue;
    }
    const voided = ownerVoid(owner, prior);
    const close = ownerClose(owner, prior);
    const hb = ownerHeartbeatMs(owner, prior);
    let why = null;
    if (voided && (!close || close.createdAtMs < voided.createdAtMs)) why = 'previous owner voided';
    else if (close && Array.isArray(close.json.missingIdx) && close.json.missingIdx.length > 0) why = 'previous close incomplete (repair)';
    else if (claim.createdAtMs - hb >= staleMs) why = 'previous owner stale (takeover)';
    if (why) {
      owner = { nonce: claim.json.nonce, mode: claim.json.mode, claim };
      ownershipLog.push({ nonce: claim.json.nonce, owns: true, why });
    } else {
      ownershipLog.push({ nonce: claim.json.nonce, owns: false, why: 'run was not pickable at claim time (lost race or live owner)' });
    }
  }

  // Current status relative to --now.
  const terminal = terminalCloseIn(events);
  const newestClose = events.filter((e) => e.kind === 'close').at(-1) ?? null;
  const checkpoints = events.filter((e) => e.kind === 'ckpt');
  const doneIndices = [...new Set(checkpoints.flatMap((e) => e.json.idx ?? []))]
    .sort((a, b) => a - b);
  const findings = checkpoints.flatMap((e) => e.json.f ?? []);

  // The claim whose params a repair/takeover must reuse: the owning claim
  // that produced the existing checkpoints; with no checkpoints, the most
  // recent owning claim.
  let originalClaim = null;
  if (owner) {
    originalClaim = {
      nonce: owner.nonce,
      groupLines: owner.claim.json.groupLines ?? null,
      groupFiles: owner.claim.json.groupFiles ?? null,
      focus: owner.claim.json.focus ?? null,
    };
  }

  // Pickability for a NEW claimer at --now.
  let pickable = 'none';
  let reason = '';
  let staleAtMs = null;
  const repairCloses = events.filter((e) => e.kind === 'close'
    && Array.isArray(e.json.missingIdx) && e.json.missingIdx.length > 0);
  const repairBreaker = repairCloses.length >= 2
    && sameSet(repairCloses.at(-1).json.missingIdx, repairCloses.at(-2).json.missingIdx);
  const voids = events.filter((e) => e.kind === 'void');
  const voidBreaker = voids.length >= 2
    && String(voids.at(-1).json.reason ?? '') === String(voids.at(-2).json.reason ?? '');

  if (terminal) {
    pickable = 'none';
    reason = 'closed complete — never pickable again';
  } else if (!owner) {
    pickable = 'scan';
    reason = 'no claims yet';
  } else {
    const voided = ownerVoid(owner, events);
    const close = ownerClose(owner, events);
    const hb = ownerHeartbeatMs(owner, events);
    staleAtMs = hb + staleMs;
    if (voided && (!close || close.createdAtMs < voided.createdAtMs)) {
      pickable = voidBreaker ? 'none' : 'voided';
      reason = voidBreaker
        ? 'two consecutive voids with the same reason — systemic failure, report to the user and stop'
        : 'owner voided its claim — immediately claimable';
    } else if (close && close.json.missingIdx.length > 0) {
      pickable = repairBreaker ? 'none' : 'repair';
      reason = repairBreaker
        ? 'same missingIdx failed twice — circuit breaker; do not retry silently (options: orchestrator scans the group itself in-session / user-confirmed waiver close / exclude via next-batch overrides / Flow F rebuild as last resort)'
        : 'incomplete close — immediately repairable';
    } else if (nowMs >= staleAtMs) {
      pickable = 'takeover';
      reason = `owner heartbeat ${new Date(hb).toISOString()} is past the staleness window`;
    } else {
      pickable = 'none';
      reason = `owner ${owner.nonce} is live; staleness unlocks at ${new Date(staleAtMs).toISOString()}`;
    }
  }

  return {
    owner: owner ? { nonce: owner.nonce, mode: owner.mode, claimedAt: owner.claim.createdAt } : null,
    ownershipLog,
    closed: newestClose ? {
      complete: Array.isArray(newestClose.json.missingIdx) && newestClose.json.missingIdx.length === 0,
      missingIdx: newestClose.json.missingIdx ?? [],
      waivedIdx: newestClose.json.waivedIdx ?? [],
      lines: newestClose.json.lines ?? null,
      nonce: newestClose.json.nonce ?? null,
      createdAt: newestClose.createdAt,
    } : null,
    doneIndices,
    checkpointCount: checkpoints.length,
    findings,
    pickable,
    pickableReason: reason,
    staleAt: staleAtMs ? new Date(staleAtMs).toISOString() : null,
    repairBreaker,
    voidBreaker,
    // Slack dedup gate: a COMPLETE close already existed → skip Slack.
    slackDedup: Boolean(terminal),
    originalClaim,
  };
}

// --------------------------------------------------------------------- args

function parseArgs(argv) {
  const args = { _flags: {} };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) fail(`unexpected argument: ${a}`);
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args._flags[key] = true;
    else {
      args._flags[key] = next;
      i += 1;
    }
  }
  return args._flags;
}

const f = parseArgs(process.argv);
const nowMs = f.now ? isoOrFail(f.now, '--now') : Date.now();
const staleMs = Number(f['stale-minutes'] ?? DEFAULT_STALE_MINUTES) * 60_000;
if (!Number.isFinite(staleMs) || staleMs <= 0) fail('invalid --stale-minutes');

function emit(obj) {
  const text = JSON.stringify(obj, null, 1);
  if (f.out) writeFileSync(f.out, text);
  console.log(text);
}

// ----------------------------------------------------------------- handlers

function opRunStatus() {
  if (!f.comments) fail('--comments <dump.json> is required');
  const { events, malformed } = parseComments(readJson(f.comments, 'comments'), 'run-status');
  if (malformed.length > 0) {
    fail(`fail-closed: ${malformed.length} protocol comment(s) with unparseable payloads: ${JSON.stringify(malformed)}. Re-dump the comments; if the payload is truly corrupt, stop and report.`);
  }
  const status = foldRun({ events, nowMs, staleMs });
  status.ownedByMe = Boolean(f['my-nonce'] && status.owner && status.owner.nonce === f['my-nonce']);
  emit(status);
}

function readTable() {
  if (!f.table) fail('--table <runs.json> is required');
  const t = readJson(f.table, 'run table');
  if (!Array.isArray(t.runs) || t.runs.length === 0) fail('run table has no runs[]');
  return t;
}

function progressFrom({ table, closedByRun, legacyRun, legacyCursor, totalLines }) {
  const closed = table.runs.filter((r) => closedByRun.get(r.r)?.complete);
  const coveredLines = closed.reduce((s, r) => s + r.lines, 0);
  return {
    closedRuns: closed.length + legacyRun, // legacy runs count as closed
    runCount: table.runs.length + legacyRun,
    coveredLines,
    totalLines: totalLines ?? null,
    note: legacyCursor > 0
      ? `coveredLines excludes the legacy prefix [0, ${legacyCursor}) — its lines are covered by definition but not in the table`
      : undefined,
  };
}

function opPickOrder() {
  const table = readTable();
  if (!f.index) fail('--index <batch-comments.json> is required');
  if (!f.nonce) fail('--nonce <hex> is required (used for probe-order shuffling)');
  const { events, malformed } = parseComments(readJson(f.index, 'index'), 'pick-order');
  if (malformed.length > 0) {
    fail(`fail-closed: unparseable batch-page protocol comment(s): ${JSON.stringify(malformed)}`);
  }
  const fence = events.find((e) => e.kind === 'batch-closed') ?? null;
  const closedByRun = new Map();
  for (const e of events) {
    if (e.kind === 'run-closed') {
      closedByRun.set(e.run, {
        complete: Array.isArray(e.json.missingIdx) && e.json.missingIdx.length === 0,
        missingIdx: e.json.missingIdx ?? [],
      });
    }
  }
  const legacyRun = Number(f['legacy-run'] ?? 0);
  const legacyCursor = Number(f['legacy-cursor'] ?? 0);

  const scanCandidates = table.runs
    .filter((r) => !closedByRun.has(r.r))
    .map((r) => ({ r: r.r, pageId: r.pageId, start: r.start, end: r.end, hint: 'scan-or-busy' }))
    .sort((a, b) => shuffleKey(f.nonce, a.r) - shuffleKey(f.nonce, b.r));
  const repairCandidates = table.runs
    .filter((r) => closedByRun.has(r.r) && !closedByRun.get(r.r).complete)
    .map((r) => ({ r: r.r, pageId: r.pageId, start: r.start, end: r.end, hint: 'repair' }));

  emit({
    fence: fence ? { reason: fence.json.reason ?? null, at: fence.createdAt } : null,
    instruction: fence
      ? 'FENCED batch: stop, re-read the state page, discard all local assumptions'
      : 'probe candidates in order with --op run-status; the first pickable one wins. A probe revealing a complete close missing from the index → post the run-closed comment (make-comment) and continue.',
    candidates: [...scanCandidates, ...repairCandidates],
    allClosedPerIndex: scanCandidates.length === 0 && repairCandidates.length === 0,
    progress: progressFrom({
      table,
      closedByRun,
      legacyRun,
      legacyCursor,
      totalLines: f['total-lines'] ? Number(f['total-lines']) : null,
    }),
  });
}

function opBatchStatus() {
  const table = readTable();
  if (!f['runs-dir']) fail('--runs-dir <dir of r<NNN>.json comment dumps> is required');
  const legacyRun = Number(f['legacy-run'] ?? 0);
  const legacyCursor = Number(f['legacy-cursor'] ?? 0);
  const files = new Set(readdirSync(f['runs-dir']));
  const open = [];
  const waived = [];
  const closedByRun = new Map();
  for (const run of table.runs) {
    const name = `r${String(run.r).padStart(3, '0')}.json`;
    if (!files.has(name)) fail(`missing dump for run ${run.r}: ${name} (dump EVERY table run page before the gate)`);
    const { events, malformed } = parseComments(readJson(join(f['runs-dir'], name), name), name);
    if (malformed.length > 0) fail(`fail-closed: ${name} has unparseable protocol comments`);
    const s = foldRun({ events, nowMs, staleMs });
    closedByRun.set(run.r, s.closed ?? { complete: false });
    if (!s.closed || !s.closed.complete) {
      open.push({ r: run.r, pickable: s.pickable, reason: s.pickableReason });
    } else if (s.closed.waivedIdx.length > 0) {
      waived.push({ r: run.r, waivedIdx: s.closed.waivedIdx });
    }
  }
  emit({
    complete: open.length === 0,
    openRuns: open,
    waived,
    progress: progressFrom({
      table,
      closedByRun,
      legacyRun,
      legacyCursor,
      totalLines: f['total-lines'] ? Number(f['total-lines']) : null,
    }),
  });
}

function opMakeComment() {
  const kind = f.kind;
  const need = (flag) => {
    if (f[flag] === undefined || f[flag] === true) fail(`--${flag} is required for --kind ${kind}`);
    return f[flag];
  };
  const dim = need('dim');
  const batch = Number(need('batch'));
  const at = f.at ?? new Date(nowMs).toISOString();
  const pad = (n) => String(n).padStart(3, '0');
  const intList = (s) => (s === undefined || s === '' ? []
    : String(s).split(',').filter(Boolean).map(Number));
  let marker;
  let payload;
  let human = f.human ?? '';
  if (kind === 'claim') {
    const run = Number(need('run'));
    marker = `[1k-cycle-scan:claim:${dim}:${batch}:${run}]`;
    payload = {
      nonce: need('nonce'),
      mode: need('mode'),
      groupLines: Number(need('group-lines')),
      groupFiles: Number(need('group-files')),
      focus: f.focus && f.focus !== true ? f.focus : null,
      at,
    };
    if (!['scan', 'repair', 'takeover'].includes(payload.mode)) fail(`invalid --mode ${payload.mode}`);
    human ||= `认领 R${pad(run)}(${payload.mode})`;
  } else if (kind === 'void') {
    const run = Number(need('run'));
    marker = `[1k-cycle-scan:void:${dim}:${batch}:${run}]`;
    payload = { nonce: need('nonce'), reason: need('reason'), at };
    human ||= `放弃 R${pad(run)}:${payload.reason}`;
  } else if (kind === 'close') {
    const run = Number(need('run'));
    marker = `[1k-cycle-scan:close:${dim}:${batch}:${run}]`;
    payload = {
      nonce: need('nonce'),
      missingIdx: intList(f['missing-idx']),
      waivedIdx: intList(f['waived-idx']),
      lines: Number(need('lines')),
      at,
    };
    human ||= payload.missingIdx.length === 0
      ? `R${pad(run)} 扫描完成`
      : `R${pad(run)} 部分完成 · 缺 ${payload.missingIdx.length} 个文件`;
  } else if (kind === 'ckpt') {
    const run = Number(need('run'));
    const group = Number(need('group'));
    marker = `[1k-cycle-scan:ckpt:${dim}:${batch}:${run}:${group}]`;
    const findings = f['findings-file'] ? readJson(f['findings-file'], 'findings') : [];
    payload = {
      g: group,
      idx: intList(need('idx')),
      lines: Number(need('lines')),
      nonce: need('nonce'),
      f: findings,
    };
    human ||= `run ${run} · group ${group} done`;
  } else if (kind === 'run-closed') {
    const run = Number(need('run'));
    marker = `[1k-cycle-scan:run-closed:${dim}:${batch}:${run}]`;
    payload = { missingIdx: intList(f['missing-idx']), lines: Number(need('lines')) };
    human ||= payload.missingIdx.length === 0
      ? `R${pad(run)} 已关`
      : `R${pad(run)} 部分关闭 · 缺 ${payload.missingIdx.length} 个文件`;
  } else if (kind === 'batch-closed') {
    marker = `[1k-cycle-scan:batch-closed:${dim}:${batch}]`;
    payload = { reason: need('reason'), at };
    human ||= `B${pad(batch)} 已终止:${payload.reason}`;
  } else {
    fail(`unknown --kind ${kind}`);
  }
  emit({ body: `${marker}\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`\n${human}` });
}

const STATE_FIELDS = [
  'v', 'dimension', 'status', 'runnerNonce', 'batch', 'batchPageId',
  'pinnedCommit', 'manifestHash', 'rulesHash', 'overrides', 'rulesSource',
  'totalFiles', 'totalLines', 'runCount', 'runLines', 'legacyCursor',
  'summaryPageId', 'prevBatchPageId', 'prevSummaryPageId', 'updatedAt',
];

function validateState(state, { expectV6 = true } = {}) {
  for (const k of STATE_FIELDS) {
    if (!(k in state)) fail(`state JSON missing field: ${k}`);
  }
  if (expectV6 && state.v !== 6) {
    fail(`state version guard: expected v=6, found v=${state.v}. If a pre-migration runner overwrote the page, restore via the state page's version history — never re-run the retrofit automatically.`);
  }
  if (!['idle', 'opening', 'summarizing', 'rebuilding'].includes(state.status)) {
    fail(`invalid state.status: ${state.status}`);
  }
  return state;
}

function opState() {
  const t = f.transition;
  const at = new Date(nowMs).toISOString();
  if (t === 'init') {
    if (!f.dimension) fail('--dimension is required for init');
    emit({
      state: {
        v: 6, dimension: f.dimension, status: 'idle', runnerNonce: null,
        batch: 0, batchPageId: null, pinnedCommit: null, manifestHash: null,
        rulesHash: null, overrides: f.overrides && f.overrides !== true ? JSON.parse(f.overrides) : null,
        rulesSource: f['rules-source'] ?? null, totalFiles: 0, totalLines: 0,
        runCount: 0, runLines: 0, legacyCursor: 0, summaryPageId: null,
        prevBatchPageId: null, prevSummaryPageId: null, updatedAt: at,
      },
      versionMessage: 'bootstrap',
    });
    return;
  }
  if (!f.state) fail('--state <state.json> is required');
  const cur = readJson(f.state, 'state');
  if (t === 'retrofit') {
    if (cur.v !== 5) fail(`retrofit expects a v5 state, found v=${cur.v}`);
    const table = readTable();
    emit({
      state: {
        v: 6, dimension: cur.dimension, status: 'idle', runnerNonce: null,
        batch: cur.batch, batchPageId: cur.batchPageId,
        pinnedCommit: cur.pinnedCommit, manifestHash: cur.manifestHash,
        rulesHash: cur.rulesHash, overrides: cur.overrides ?? null,
        rulesSource: cur.rulesSource, totalFiles: cur.totalFiles,
        totalLines: cur.totalLines, runCount: (cur.run ?? 0) + table.runs.length,
        runLines: table.runLines, legacyCursor: cur.cursor ?? 0,
        summaryPageId: cur.summaryPageId ?? null,
        prevBatchPageId: cur.prevBatchPageId ?? null,
        prevSummaryPageId: cur.prevSummaryPageId ?? null, updatedAt: at,
      },
      versionMessage: `retrofit v5→v6 · legacy cursor ${cur.cursor ?? 0} · ${table.runs.length} table runs`,
    });
    return;
  }
  const state = validateState(cur);
  const next = { ...state, updatedAt: at };
  let versionMessage;
  if (t === 'lock') {
    const flow = f.flow;
    if (!['opening', 'summarizing', 'rebuilding'].includes(flow)) fail('--flow opening|summarizing|rebuilding required');
    if (!f.nonce) fail('--nonce required');
    const staleAt = Date.parse(state.updatedAt) + staleMs;
    if (state.status !== 'idle' && nowMs < staleAt) {
      fail(`state lock is held (status=${state.status}, stale at ${new Date(staleAt).toISOString()}) — cannot lock`);
    }
    next.status = flow;
    next.runnerNonce = f.nonce;
    versionMessage = `lock: ${flow}`;
  } else if (t === 'unlock') {
    next.status = 'idle';
    next.runnerNonce = null;
    versionMessage = f.message ?? 'unlock';
  } else if (t === 'open-batch') {
    for (const k of ['batch-page-id', 'pin', 'manifest-hash', 'rules-hash', 'total-files', 'total-lines', 'run-count', 'run-lines']) {
      if (f[k] === undefined) fail(`--${k} is required for open-batch`);
    }
    if (state.status !== 'opening' && state.status !== 'rebuilding') {
      fail('open-batch requires the lock (status=opening, or rebuilding via Flow F) — lock first');
    }
    next.batch = state.batch + 1;
    next.prevBatchPageId = state.batchPageId;
    next.prevSummaryPageId = state.summaryPageId;
    next.batchPageId = f['batch-page-id'];
    next.pinnedCommit = f.pin;
    next.manifestHash = f['manifest-hash'];
    next.rulesHash = f['rules-hash'];
    next.overrides = f.overrides && f.overrides !== true ? JSON.parse(f.overrides) : state.overrides;
    next.totalFiles = Number(f['total-files']);
    next.totalLines = Number(f['total-lines']);
    next.runCount = Number(f['run-count']);
    next.runLines = Number(f['run-lines']);
    next.legacyCursor = 0;
    next.summaryPageId = null;
    next.status = 'idle';
    next.runnerNonce = null;
    versionMessage = `batch ${next.batch} open · ${next.runCount} runs`;
  } else if (t === 'close-summary') {
    if (state.status !== 'summarizing') fail('close-summary requires the lock (status=summarizing)');
    if (!f['summary-page-id']) fail('--summary-page-id is required');
    next.summaryPageId = f['summary-page-id'];
    next.status = 'idle';
    next.runnerNonce = null;
    versionMessage = `batch ${state.batch} complete · summary ready`;
  } else {
    fail(`unknown --transition ${t}`);
  }
  emit({ state: next, versionMessage });
}

function opRoute() {
  if (!f.state) fail('--state <state.json> is required');
  const sub = f.subcommand ?? 'scan';
  if (sub === 'status' || sub === 'report') {
    emit({ flow: 'A', reason: 'read-only subcommand' });
    return;
  }
  if (sub === 'rebuild') {
    emit({ flow: 'F', reason: 'explicit rebuild (destructive; needs user confirmation)' });
    return;
  }
  const cur = readJson(f.state, 'state');
  if (cur.v === 5) {
    emit({ flow: 'retrofit', reason: 'v5 state — migrate before scanning' });
    return;
  }
  const state = validateState(cur);
  if (state.batch === 0) {
    emit({ flow: 'C', reason: 'no batch yet' });
    return;
  }
  if (!f.index || !f.table) {
    emit({ flow: 'D', reason: 'no --index/--table provided; Flow D will read the batch page and may re-route to C/E' });
    return;
  }
  const table = readTable();
  const { events } = parseComments(readJson(f.index, 'index'), 'route');
  const closed = new Map();
  for (const e of events) {
    if (e.kind === 'run-closed') {
      closed.set(e.run, Array.isArray(e.json.missingIdx) && e.json.missingIdx.length === 0);
    }
  }
  // Advisory only (index is best-effort): Flow E re-verifies authoritatively.
  const allClosed = table.runs.every((r) => closed.get(r.r) === true);
  if (allClosed && state.summaryPageId) {
    emit({ flow: 'C', reason: 'batch complete and summarized — open the next batch' });
  } else if (allClosed) {
    emit({ flow: 'E', reason: 'index shows every run closed — verify authoritatively (batch-status) then summarize' });
  } else {
    emit({ flow: 'D', reason: 'open runs remain' });
  }
}

const ops = {
  'run-status': opRunStatus,
  'pick-order': opPickOrder,
  'batch-status': opBatchStatus,
  'make-comment': opMakeComment,
  state: opState,
  route: opRoute,
};
if (!f.op || !ops[f.op]) fail(`--op must be one of: ${Object.keys(ops).join(', ')}`);
ops[f.op]();
