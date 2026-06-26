/* eslint-disable no-console */
/**
 * win-perf-cdp.mjs — post-attach performance capture for the OneKey desktop
 * (Electron) renderer over CDP, for the Windows remote-perf investigation.
 *
 * The t=0 *startup* trace is captured on Windows by build-launch-perf-win.ps1
 * (--trace-startup). This script handles the QUANTITATIVE, target-specific
 * captures that startup tracing can't aim precisely: per-renderer CPU profiles,
 * heap snapshots (+ a cheap stats probe before pulling a multi-GB snapshot),
 * and console capture. It can target the `main` (UI) vs `background` runtime
 * separately — they are isolated JS heaps in the same process.
 *
 * Connects over an SSH tunnel (localhost:9222 -> Windows 127.0.0.1:9222).
 * Uses playwright-core (already a root dependency).
 *
 * Usage:
 *   node development/scripts/win-perf-cdp.mjs targets
 *   node development/scripts/win-perf-cdp.mjs profile  --target main --duration 20 --out .tmp/win-perf/main.cpuprofile
 *   node development/scripts/win-perf-cdp.mjs heapstats --target main
 *   node development/scripts/win-perf-cdp.mjs heap      --target main --out .tmp/win-perf/main.heapsnapshot
 *   node development/scripts/win-perf-cdp.mjs console   --target main --duration 15 --out .tmp/win-perf/main-console.log
 *
 * Env: CDP_URL (default http://127.0.0.1:9222)
 *
 * --target matches a page by substring of its URL (case-insensitive). Common
 * picks: "index.html" / "" for the main UI window, "background" for the bg
 * runtime. Run `targets` first to see the exact URLs.
 */

import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        i += 1;
      }
    } else args._.push(a);
  }
  return args;
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
}

async function listTargets() {
  // Hit the raw /json endpoint so we see EVERY target (page, webview, worker,
  // "other"), not just what playwright surfaces as pages.
  const res = await fetch(`${CDP_URL}/json`);
  if (!res.ok) throw new Error(`GET ${CDP_URL}/json -> ${res.status}`);
  return res.json();
}

async function connect() {
  try {
    return await chromium.connectOverCDP(CDP_URL);
  } catch (e) {
    console.error(
      `Could not connect to CDP at ${CDP_URL}. Is the tunnel up and the app running?\n${
        e.message || e
      }`,
    );
    process.exit(1);
  }
}

// Pick a PAGE whose URL contains `match` (case-insensitive). With no match,
// returns the first page. Prints all candidate URLs to help disambiguate.
//
// NOTE: profile/heap/console are page-only. playwright's connectOverCDP only
// surfaces page-type targets; non-page targets (webview/worker/"other", e.g. an
// Electron background runtime) appear in `targets` (raw /json) but cannot be
// attached here. On a miss we cross-reference /json so we can say *why* a target
// is unreachable instead of leaving the user to guess (or attach to the wrong
// foreground page).
async function pickPage(browser, match) {
  const pages = [];
  for (const ctx of browser.contexts()) {
    for (const page of ctx.pages()) pages.push(page);
  }
  if (pages.length === 0) {
    console.error('No pages exposed over CDP. Run `targets` to inspect.');
    process.exit(1);
  }
  const urls = pages.map((p) => p.url());
  console.error(`pages: ${urls.map((u, i) => `[${i}] ${u}`).join('  ')}`);
  if (!match || match === true) return pages[0];
  const needle = String(match).toLowerCase();
  const idx = urls.findIndex((u) => u.toLowerCase().includes(needle));
  if (idx === -1) {
    // Distinguish "no such target" from "target exists but is not a page".
    let nonPageHit;
    try {
      const targets = await listTargets();
      nonPageHit = targets.find(
        (t) =>
          (t.type || '').toLowerCase() !== 'page' &&
          `${t.title || ''} ${t.url || ''}`.toLowerCase().includes(needle),
      );
    } catch {
      // ignore — fall through to the generic message
    }
    if (nonPageHit) {
      console.error(
        `"${match}" matches a non-page target (type=${nonPageHit.type}, url=${nonPageHit.url}). ` +
          `profile/heap/console only support page targets, so it cannot be attached here. ` +
          `Use \`targets\` to inspect; attach a page-type target instead.`,
      );
    } else {
      console.error(
        `No page URL contains "${match}". Pick from the list above.`,
      );
    }
    process.exit(1);
  }
  console.error(`-> picked [${idx}] ${urls[idx]}`);
  return pages[idx];
}

async function cmdTargets() {
  const targets = await listTargets();
  for (const t of targets) {
    console.log(`${(t.type || '?').padEnd(10)} ${t.title || ''}`.trim());
    console.log(`           ${t.url}`);
  }
  console.log(`\n${targets.length} target(s).`);
}

async function cmdProfile(args) {
  const durationMs = Number(args.duration || 20) * 1000;
  const out = args.out || `.tmp/win-perf/profile.cpuprofile`;
  const browser = await connect();
  const page = await pickPage(browser, args.target);
  const session = await page.context().newCDPSession(page);
  // V8 sampling interval in microseconds. Default to V8's conservative 1000us:
  // a tighter interval (e.g. 100us) samples 10x more often, and the profiler's
  // own overhead then perturbs exactly the startup-jank / render-storm we are
  // trying to observe (inflated self-time and hotspot share). Override only when
  // you knowingly want finer resolution: `--sampling-interval 250`.
  const samplingInterval = Number(args['sampling-interval'] || 1000);
  await session.send('Profiler.enable');
  await session.send('Profiler.setSamplingInterval', {
    interval: samplingInterval,
  });
  await session.send('Profiler.start');
  console.error(
    `profiling ${durationMs / 1000}s (sampling ${samplingInterval}us) ...`,
  );
  await sleep(durationMs);
  const { profile } = await session.send('Profiler.stop');
  ensureDir(out);
  fs.writeFileSync(out, JSON.stringify(profile));
  // Quick top-of-stack summary so we get signal without opening DevTools.
  summarizeCpuProfile(profile);
  console.error(
    `cpu profile -> ${path.resolve(out)} (open in DevTools > Performance > Load profile)`,
  );
  await session.detach().catch(() => {});
}

// Self-time histogram by function — surfaces a render-storm (one frame
// dominating) vs spread-out compile/evaluate cost, straight from the CLI.
function summarizeCpuProfile(profile) {
  const { nodes, samples, timeDeltas } = profile;
  if (!nodes || !samples) return;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const selfUs = new Map();
  for (let i = 0; i < samples.length; i += 1) {
    const id = samples[i];
    const dt = timeDeltas?.[i] ?? 0;
    const node = byId.get(id);
    if (node) {
      const cf = node.callFrame || {};
      const key = `${cf.functionName || '(anonymous)'} @ ${shortUrl(cf.url)}:${cf.lineNumber ?? '?'}`;
      selfUs.set(key, (selfUs.get(key) || 0) + dt);
    }
  }
  const total = [...selfUs.values()].reduce((a, b) => a + b, 0) || 1;
  const top = [...selfUs.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 15);
  console.error(
    `\n  top self-time frames (of ${(total / 1000).toFixed(0)}ms sampled):`,
  );
  for (const [k, us] of top) {
    const pct = ((us / total) * 100).toFixed(1).padStart(5);
    console.error(`   ${pct}%  ${(us / 1000).toFixed(0).padStart(6)}ms  ${k}`);
  }
}

function shortUrl(u) {
  if (!u) return '(native)';
  try {
    const url = new URL(u);
    return url.pathname.split('/').slice(-2).join('/');
  } catch {
    return u.split('/').slice(-2).join('/');
  }
}

// Cheap heap size probe — read sampling stats WITHOUT pulling a full (possibly
// multi-GB) snapshot back over the wire. Use this to decide whether a full
// `heap` dump is worth it.
async function cmdHeapStats(args) {
  const browser = await connect();
  const page = await pickPage(browser, args.target);
  const session = await page.context().newCDPSession(page);
  const metrics = await session
    .send('Performance.getMetrics')
    .catch(() => null);
  if (metrics) {
    const wanted = new Set([
      'JSHeapUsedSize',
      'JSHeapTotalSize',
      'Nodes',
      'JSEventListeners',
      'Documents',
      'Frames',
      'LayoutCount',
      'RecalcStyleCount',
    ]);
    console.log('Performance.getMetrics:');
    for (const m of metrics.metrics) {
      if (wanted.has(m.name)) {
        const v = /Heap/.test(m.name)
          ? `${(m.value / 1_048_576).toFixed(1)} MB`
          : m.value;
        console.log(`  ${m.name.padEnd(20)} ${v}`);
      }
    }
  }
  // JS heap usage via runtime, as a cross-check.
  const usage = await session
    .send('Runtime.evaluate', {
      expression:
        'JSON.stringify(performance.memory ? {used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize, limit: performance.memory.jsHeapSizeLimit} : null)',
      returnByValue: true,
    })
    .catch(() => null);
  if (usage?.result?.value) {
    const m = JSON.parse(usage.result.value);
    if (m) {
      console.log('performance.memory:');
      console.log(`  used  ${(m.used / 1_048_576).toFixed(1)} MB`);
      console.log(`  total ${(m.total / 1_048_576).toFixed(1)} MB`);
      console.log(`  limit ${(m.limit / 1_048_576).toFixed(1)} MB`);
    }
  }
  await session.detach().catch(() => {});
}

async function cmdHeap(args) {
  const out = args.out || `.tmp/win-perf/heap.heapsnapshot`;
  const browser = await connect();
  const page = await pickPage(browser, args.target);
  const session = await page.context().newCDPSession(page);
  ensureDir(out);
  const stream = fs.createWriteStream(out);
  let bytes = 0;
  session.on('HeapProfiler.addHeapSnapshotChunk', (e) => {
    bytes += e.chunk.length;
    stream.write(e.chunk);
  });
  await session.send('HeapProfiler.enable');
  console.error('taking heap snapshot (may be large) ...');
  await session.send('HeapProfiler.takeHeapSnapshot', {
    reportProgress: false,
    captureNumericValue: false,
  });
  stream.end();
  await new Promise((r) => stream.on('finish', r));
  console.error(
    `heap snapshot -> ${path.resolve(out)} (${(bytes / 1_048_576).toFixed(1)} MB; open in DevTools > Memory > Load)`,
  );
  await session.detach().catch(() => {});
}

async function cmdConsole(args) {
  const durationMs = Number(args.duration || 15) * 1000;
  const out = args.out;
  const browser = await connect();
  const page = await pickPage(browser, args.target);
  const lines = [];
  const push = (s) => {
    lines.push(s);
    console.error(s);
  };
  page.on('console', (m) => push(`[${m.type()}] ${m.text().split('\n')[0]}`));
  page.on('pageerror', (e) => push(`[pageerror] ${e.message.split('\n')[0]}`));
  console.error(`collecting console ${durationMs / 1000}s ...`);
  await sleep(durationMs);
  if (out) {
    ensureDir(out);
    fs.writeFileSync(out, lines.join('\n'));
    console.error(`console -> ${path.resolve(out)} (${lines.length} lines)`);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (cmd) {
    case 'targets':
      await cmdTargets();
      break;
    case 'profile':
      await cmdProfile(args);
      break;
    case 'heapstats':
      await cmdHeapStats(args);
      break;
    case 'heap':
      await cmdHeap(args);
      break;
    case 'console':
      await cmdConsole(args);
      break;
    default:
      console.error(
        'Usage: win-perf-cdp.mjs <targets|profile|heapstats|heap|console> [--target <urlsubstr>] [--duration <s>] [--out <file>]',
      );
      process.exit(1);
  }
  // Never close the browser — it is the live app under test.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
