#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Parses the latest "testAESGcmV2 done" block from the Metro log file written
 * by apps/mobile/metro.config.js's onekey-log middleware, then renders an
 * HTML report focused on:
 *   - which iteration count each task used
 *   - which backend (native / noble) each task went through
 *   - how long each task took
 *
 * Usage:
 *   node development/render-crypto-test-report.mjs                       # /tmp/onekey-rn.log -> /tmp/aes-gcm-v2-test-report.html
 *   node development/render-crypto-test-report.mjs --in some.log --out r.html --open
 *
 * Flags:
 *   --in <path>    log file (default: /tmp/onekey-rn.log)
 *   --out <path>   output HTML (default: /tmp/aes-gcm-v2-test-report.html)
 *   --open         open the generated HTML in the default browser
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = {
    in: '/tmp/onekey-rn.log',
    out: '/tmp/aes-gcm-v2-test-report.html',
    open: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--open') args.open = true;
    else if (a === '-h' || a === '--help') {
      console.log(
        'usage: render-crypto-test-report.mjs [--in path] [--out path] [--open]',
      );
      process.exit(0);
    }
  }
  return args;
}

function extractLatestPayload(logText) {
  const marker = 'testAESGcmV2 done';
  const lastMarkerIndex = logText.lastIndexOf(marker);
  if (lastMarkerIndex === -1) {
    throw new Error(
      `No "${marker}" block found in log file. Run the AES-GCM v2 test first.`,
    );
  }
  // Header line is "testAESGcmV2 done (allPassed=true, taskCount=31)".
  const headerLineEnd = logText.indexOf('\n', lastMarkerIndex);
  const headerLine = logText.slice(lastMarkerIndex, headerLineEnd);
  const headerMatch = headerLine.match(
    /allPassed=(true|false),\s*taskCount=(\d+)/,
  );
  const allPassed = headerMatch?.[1] === 'true';
  const taskCount = headerMatch ? Number(headerMatch[2]) : undefined;

  // The JSON body starts at the first "{" after the header and continues
  // until the matching "}" at column 0 (line starts with "}").
  const jsonStart = logText.indexOf('{', headerLineEnd);
  if (jsonStart === -1) throw new Error('No JSON body after header.');
  const tail = logText.slice(jsonStart);
  const closingLineMatch = tail.match(/\n\}\s*(?:\n|$)/);
  if (!closingLineMatch) {
    throw new Error('Could not locate JSON closing brace.');
  }
  const jsonEnd = closingLineMatch.index + closingLineMatch[0].indexOf('}') + 1;
  const jsonText = tail.slice(0, jsonEnd);
  let body;
  try {
    body = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse JSON body: ${e.message}`);
  }
  return { body, allPassed, taskCount, blockHeader: headerLine };
}

// Best-effort classification of a task name into (op, iter, backend, isProbe).
// Driven by the op category first, so AES-GCM primitive tests ("AES-GCM
// default wrapper matches noble") aren't mis-labelled as iter=600000 +
// backend=noble just because those keywords appear in the name.
function classifyTask(name, ctx) {
  let op = 'other';
  if (/^encryptAsync\b/.test(name)) op = 'encryptAsync';
  else if (/^decryptAsync\b/.test(name)) op = 'decryptAsync';
  else if (/^PBKDF2\b/.test(name)) op = 'PBKDF2';
  else if (/^AES-GCM\b/.test(name)) op = 'AES-GCM';
  else if (/^actual\b/.test(name)) op = 'probe';

  const isProbe =
    op === 'probe' ||
    /^encryptAsync\s+\S+\s+actual/.test(name) ||
    /^decryptAsync\s+\S+\s+actual/.test(name) ||
    /^encryptAsync\s+(default writes|default iterations|v2 prefix)/.test(
      name,
    ) ||
    /^actual\s+payload\b|^actual\s+PBKDF2|^actual\s+AES-GCM/.test(name);

  let iter;
  let backend = '—';

  if (op === 'AES-GCM') {
    // AES-GCM primitive consistency tests have no KDF iter. The fn that
    // actually runs depends on the name pattern:
    //   "AES-GCM noble encrypt"           -> the fn runs noble
    //   "AES-GCM ... matches noble"       -> the fn runs default/native;
    //                                        the word "noble" only names
    //                                        the comparison target.
    //   "AES-GCM native ..."              -> native
    iter = undefined;
    if (/^AES-GCM\s+noble\b/.test(name)) backend = 'noble';
    else backend = 'native';
  } else if (op === 'PBKDF2') {
    const iterMatch = name.match(/\b(\d{4,})\b/);
    if (iterMatch) iter = Number(iterMatch[1]);
    if (/\bnoble\b/.test(name)) backend = 'noble';
    else if (/\bnative\b/.test(name)) backend = 'native';
    else if (/\bdefault\b/.test(name)) backend = 'native';
  } else if (op === 'encryptAsync' || op === 'decryptAsync') {
    const iterMatch = name.match(/\b(\d{4,})\b/);
    if (iterMatch) iter = Number(iterMatch[1]);
    if (/\bnoble\b/.test(name)) backend = 'noble';
    else if (/\bnative\b/.test(name)) backend = 'native';
    else if (
      /default writes|default iterations|reads v2 payload/.test(name) ||
      /^encryptAsync\s+default\b/.test(name)
    ) {
      backend = 'native';
      if (!iter && ctx?.defaultIter) iter = ctx.defaultIter;
    }
  } else if (op === 'probe') {
    // "actual default xxx" → default path, iter = defaultIter
    if (/default/i.test(name) && ctx?.defaultIter) iter = ctx.defaultIter;
    else {
      const iterMatch = name.match(/\b(\d{4,})\b/);
      if (iterMatch) iter = Number(iterMatch[1]);
    }
  }

  return { isProbe, iter, backend, op };
}

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml({ body, allPassed, taskCount, blockHeader, sourcePath }) {
  const platform = body.platform || {};
  const defaultPath = body.defaultPath || {};
  const defaultIter = defaultPath.iterations;
  const ctx = { defaultIter };
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];

  const classified = tasks.map((t) => ({
    raw: t,
    ...classifyTask(t.name, ctx),
  }));

  const computeRows = classified.filter(
    (r) =>
      !r.isProbe &&
      (r.op === 'encryptAsync' ||
        r.op === 'decryptAsync' ||
        r.op === 'PBKDF2' ||
        r.op === 'AES-GCM' ||
        r.raw.name === 'decryptAsync reads v2 payload'),
  );

  // Re-label "decryptAsync reads v2 payload" => decryptAsync default-path.
  for (const r of computeRows) {
    if (r.raw.name === 'decryptAsync reads v2 payload') {
      r.op = 'decryptAsync';
      r.backend = 'native';
      if (!r.iter) r.iter = defaultIter;
    }
  }

  const totalCompute = computeRows.reduce(
    (acc, r) => acc + (r.raw.time || 0),
    0,
  );

  // testAESGcmV2 records every encryptAsync round-trip into actualEncryptRuns
  // (separate from the `tasks` array). The default-path encryptAsync run at
  // the end of the test is ONLY captured there. Surface those as synthetic
  // compute rows so the matrix doesn't miss the default-iter encryptAsync.
  const syntheticEncRows = Array.isArray(body.actualEncryptRuns)
    ? body.actualEncryptRuns.map((run, idx) => {
        const iter =
          run.requestedIterations === 'default'
            ? defaultIter
            : Number(run.requestedIterations);
        const backend = run.pbkdf2Invocation?.backend === 'noble'
          ? 'noble'
          : 'native';
        return {
          raw: {
            time: run.time,
            name: `actualEncryptRuns[${idx}] (requested=${run.requestedIterations}, payload=${run.payloadIterations})`,
            isCorrect: '✅',
          },
          op: 'encryptAsync',
          iter,
          backend,
          isProbe: false,
          synthetic: true,
        };
      })
    : [];

  // Full pivot: rows = iter (incl. '—' for primitives that have no KDF iter),
  // columns = op × backend. Empty cells render as muted '—'. Tasks fill first,
  // then synthetic encryptAsync rows fill any remaining gaps.
  const MATRIX_OPS = ['PBKDF2', 'AES-GCM', 'encryptAsync', 'decryptAsync'];
  const NO_ITER = '__no_iter';
  const pivot = {};
  function pivotFill(r) {
    if (!MATRIX_OPS.includes(r.op)) return;
    const iterKey = r.iter ?? NO_ITER;
    pivot[iterKey] = pivot[iterKey] || {};
    pivot[iterKey][r.op] = pivot[iterKey][r.op] || {};
    if (pivot[iterKey][r.op][r.backend] === undefined) {
      pivot[iterKey][r.op][r.backend] = r.raw.time;
    }
  }
  for (const r of computeRows) pivotFill(r);
  for (const r of syntheticEncRows) pivotFill(r);

  const allComputeRows = [...computeRows, ...syntheticEncRows];
  const iterKeys = Object.keys(pivot).sort((a, b) => {
    if (a === NO_ITER) return -1;
    if (b === NO_ITER) return 1;
    return Number(a) - Number(b);
  });
  function pivotCell(iterKey, op, backend) {
    const v = pivot[iterKey]?.[op]?.[backend];
    if (v === undefined) return '<td class="time muted">—</td>';
    const cls =
      v >= 100 ? 'slow' : v <= 5 ? 'fast' : v <= 200 ? '' : 'mid';
    return `<td class="time ${cls}">${v} ms</td>`;
  }
  const pivotRows = iterKeys
    .map((iterKey) => {
      const iterLabel =
        iterKey === NO_ITER ? '—' : Number(iterKey).toLocaleString();
      const cells = MATRIX_OPS.map(
        (op) => pivotCell(iterKey, op, 'native') + pivotCell(iterKey, op, 'noble'),
      ).join('');
      return `<tr><td class="iter">${iterLabel}</td>${cells}</tr>`;
    })
    .join('\n');

  // Side-by-side comparison: only emit (iter, op) rows that have both a
  // native AND a noble measurement, so every cell is a real number. The
  // unpaired runs (single-backend, no-iter primitives) go into a separate
  // table below.
  const grouped = {};
  for (const r of allComputeRows) {
    if (!r.iter) continue;
    if (!['PBKDF2', 'encryptAsync', 'decryptAsync'].includes(r.op)) continue;
    const k = `${r.iter}::${r.op}`;
    grouped[k] = grouped[k] || { iter: r.iter, op: r.op };
    if (grouped[k][r.backend] === undefined)
      grouped[k][r.backend] = r.raw.time;
  }
  const comparisonRows = Object.values(grouped)
    .filter((g) => g.native !== undefined && g.noble !== undefined)
    .sort((a, b) => a.iter - b.iter || a.op.localeCompare(b.op))
    .map((g) => {
      const ratio = g.native > 0 ? Math.round(g.noble / g.native) : '∞';
      const ratioCls = typeof ratio === 'number' && ratio >= 50 ? 'slow' : '';
      return `<tr>
        <td class="iter">${g.iter.toLocaleString()}</td>
        <td class="op">${htmlEscape(g.op)}</td>
        <td class="time fast">${g.native} ms</td>
        <td class="time slow">${g.noble} ms</td>
        <td class="ratio ${ratioCls}">${ratio}×</td>
      </tr>`;
    })
    .join('\n');

  // Unpaired single-backend rows (no horizontal comparison available).
  const unpairedRows = allComputeRows
    .filter((r) => {
      if (!r.iter) return true; // primitives without iter (AES-GCM raw)
      const k = `${r.iter}::${r.op}`;
      const g = grouped[k];
      if (!g) return true;
      return g.native === undefined || g.noble === undefined;
    })
    .map((r) => {
      const iterCell = r.iter ? r.iter.toLocaleString() : '<span class="muted">—</span>';
      const timeCls = r.raw.time >= 100 ? 'slow' : r.raw.time <= 5 ? 'fast' : '';
      const badgeCls = r.backend === 'noble' ? 'noble' : 'native';
      return `<tr>
        <td class="op">${htmlEscape(r.op)}</td>
        <td class="iter">${iterCell}</td>
        <td><span class="badge ${badgeCls}">${htmlEscape(r.backend)}</span></td>
        <td class="time ${timeCls}">${r.raw.time} ms</td>
        <td class="name">${htmlEscape(r.raw.name)}</td>
      </tr>`;
    })
    .join('\n');

  const detailRows = allComputeRows
    .map((r, idx) => {
      const slow =
        r.raw.isSlow || (r.raw.time && r.raw.time >= 100) ? '🐌' : '';
      const badgeCls = r.backend === 'noble' ? 'noble' : 'native';
      const iterCell = r.iter ? r.iter.toLocaleString() : '—';
      const timeCls =
        r.raw.time >= 100 ? 'slow' : r.raw.time <= 5 ? 'fast' : '';
      return `<tr>
        <td class="idx">${idx + 1}</td>
        <td class="op">${htmlEscape(r.op)}</td>
        <td class="iter">${iterCell}</td>
        <td><span class="badge ${badgeCls}">${htmlEscape(r.backend)}</span></td>
        <td class="time ${timeCls}">${r.raw.time} ms ${slow}</td>
        <td class="name">${htmlEscape(r.raw.name)}</td>
        <td class="check">${r.raw.isCorrect || ''}</td>
      </tr>`;
    })
    .join('\n');

  const probeRows = classified
    .filter((r) => r.isProbe)
    .map(
      (r) => `<tr>
        <td>${htmlEscape(r.raw.name)}</td>
        <td><code>${htmlEscape(r.raw.result ?? '')}</code></td>
        <td class="check">${r.raw.isCorrect || ''}</td>
      </tr>`,
    )
    .join('\n');

  // The single table the user asked for: 7 rows × 2 backend columns.
  // Iter values come from the log's defaultPath.iterations so the table
  // tracks PBKDF2_CURRENT_NUM_OF_ITERATIONS automatically instead of
  // hard-coding 600,000.
  const fmt = (n) => n.toLocaleString();
  const SIMPLE_ROWS = [
    { labelTop: 'AES-GCM', labelBottom: '', op: 'AES-GCM', iter: null },
    { labelTop: 'pbkdf2', labelBottom: fmt(5000), op: 'PBKDF2', iter: 5000 },
    {
      labelTop: 'pbkdf2',
      labelBottom: defaultIter ? fmt(defaultIter) : '—',
      op: 'PBKDF2',
      iter: defaultIter,
    },
    {
      labelTop: 'encryptAsync',
      labelBottom: fmt(5000),
      op: 'encryptAsync',
      iter: 5000,
    },
    {
      labelTop: 'encryptAsync',
      labelBottom: defaultIter ? fmt(defaultIter) : '—',
      op: 'encryptAsync',
      iter: defaultIter,
    },
    {
      labelTop: 'decryptAsync',
      labelBottom: fmt(5000),
      op: 'decryptAsync',
      iter: 5000,
    },
    {
      labelTop: 'decryptAsync',
      labelBottom: defaultIter ? fmt(defaultIter) : '—',
      op: 'decryptAsync',
      iter: defaultIter,
    },
  ];
  function lookup(op, iter, backend) {
    const iterKey = iter ?? NO_ITER;
    return pivot[iterKey]?.[op]?.[backend];
  }
  function cellHtml(value) {
    if (value === undefined) return '<td class="time muted">—</td>';
    const cls =
      value >= 100 ? 'slow' : value <= 5 ? 'fast' : value <= 200 ? '' : 'mid';
    return `<td class="time ${cls}">${value} ms</td>`;
  }
  const simpleRows = SIMPLE_ROWS.map((row) => {
    const noble = lookup(row.op, row.iter, 'noble');
    const native = lookup(row.op, row.iter, 'native');
    const labelHtml = row.labelBottom
      ? `<div class="op-name">${htmlEscape(row.labelTop)}</div><div class="op-iter">${htmlEscape(row.labelBottom)}</div>`
      : `<div class="op-name">${htmlEscape(row.labelTop)}</div>`;
    return `<tr><td class="op">${labelHtml}</td>${cellHtml(noble)}${cellHtml(native)}</tr>`;
  }).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>AES-GCM v2 — 实测报告</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{
  color-scheme: light dark;
  --bg:#fafafa; --fg:#1a1a1a; --muted:#888; --border:#d0d0d0; --row-alt:#f0f0f0;
  --slow:#c5221f; --fast:#137333; --mid:#b06c00;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#1a1a1a; --fg:#e8e8e8; --muted:#888; --border:#333; --row-alt:#222;
    --slow:#ff7b7b; --fast:#6dd58c; --mid:#ffb255;
  }
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:40px;line-height:1.55;display:flex;justify-content:center}
.wrap{max-width:560px;width:100%}
h1{margin:0 0 4px;font-size:20px}
p.meta{color:var(--muted);font-size:12px;margin:0 0 24px}
table{width:100%;border-collapse:collapse;font-size:15px}
table colgroup col:first-child{width:55%}
th,td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
th{background:var(--row-alt);font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;border-bottom:2px solid var(--border)}
th:first-child{text-align:left}
td.op{font-weight:500;line-height:1.3}
td.op .op-name{font-weight:600}
td.op .op-iter{color:var(--muted);font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px;font-weight:500}
td.time{font-family:'SF Mono',Menlo,Consolas,monospace;font-weight:700;text-align:right;white-space:nowrap}
td.time.slow{color:var(--slow)}
td.time.fast{color:var(--fast)}
td.time.mid{color:var(--mid)}
td.time.muted{color:var(--muted);text-align:center;font-weight:400}
p.note{color:var(--muted);font-size:12px;margin-top:14px}
</style>
</head>
<body>
<div class="wrap">
<h1>AES-GCM v2 — 实测耗时</h1>
<p class="meta">${htmlEscape(blockHeader.trim())}</p>
<table>
  <colgroup><col><col><col></colgroup>
  <thead>
    <tr><th></th><th>noble</th><th>native</th></tr>
  </thead>
  <tbody>
${simpleRows}
  </tbody>
</table>
<p class="note">"—" 表示这次运行没采到对应耗时(noble 600,000 被 BACKEND_MATRIX_MAX_ITER=10,000 守卫挡了;pbkdf2 600,000 没单跑,只通过 encryptAsync 默认路径间接跑过;AES-GCM 原语只跑了 native)。</p>
</div>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = path.resolve(args.in);
  const outPath = path.resolve(args.out);

  const logText = fs.readFileSync(inPath, 'utf8');
  const parsed = extractLatestPayload(logText);
  const html = renderHtml({ ...parsed, sourcePath: inPath });
  fs.writeFileSync(outPath, html);
  console.log(
    `Wrote ${outPath} (taskCount=${parsed.taskCount}, allPassed=${parsed.allPassed})`,
  );

  if (args.open) {
    const opener =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'cmd'
          : 'xdg-open';
    const openerArgs =
      process.platform === 'win32' ? ['/c', 'start', '', outPath] : [outPath];
    execFile(opener, openerArgs, (err) => {
      if (err) console.error('Failed to open:', err.message);
    });
  }
}

main();
