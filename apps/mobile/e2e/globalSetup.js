/**
 * Custom Detox Jest globalSetup:
 * - Runs Detox default init.
 * - (Debug/Metro only) waits for Metro and warms up the first bundle compile once.
 *
 * This keeps the actual test file focused on the perf loop only.
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForMetroReady({
  metroUrl = 'http://localhost:8081',
  timeoutMs = 120_000,
  pollIntervalMs = 500,
}) {
  const base = String(metroUrl).replace(/\/$/, '');
  const statusUrl = `${base}/status`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 1500);
      try {
        const res = await fetch(statusUrl, { signal: controller.signal });
        const text = await res.text().catch(() => '');
        if (res.ok && typeof text === 'string' && text.includes('running')) {
          return;
        }
      } finally {
        clearTimeout(t);
      }
    } catch {
      // ignore; keep polling
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timeout waiting for Metro to be ready at ${statusUrl} (timeoutMs=${timeoutMs})`,
  );
}

async function warmUpMetroBundle({
  bundleUrl,
  timeoutMs = 5 * 60 * 1000,
} = {}) {
  if (!bundleUrl) return;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // eslint-disable-next-line no-console
    console.log(`[perf] warmup: bundling ${bundleUrl}`);
    const res = await fetch(bundleUrl, { signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Metro bundle warmup failed (${res.status} ${res.statusText}): ${text}`,
      );
    }
    // Consume body to ensure Metro finishes generating the bundle.
    await res.arrayBuffer();
    // eslint-disable-next-line no-console
    console.log('[perf] warmup: bundle ready');
  } finally {
    clearTimeout(t);
  }
}

module.exports = async () => {
  await require('detox/runners/jest/globalSetup')();

  if (process.env.PERF_USE_METRO === '0') return;

  const metroPlatform = (() => {
    const v = String(process.env.PERF_METRO_PLATFORM || '').toLowerCase();
    if (v === 'android' || v === 'ios') return v;
    const cfg = String(process.env.DETOX_CONFIGURATION || '').toLowerCase();
    if (cfg.includes('android')) return 'android';
    return 'ios';
  })();

  const metroAppId =
    process.env.PERF_METRO_APP_ID ||
    (metroPlatform === 'android' ? 'so.onekey.app.wallet' : 'so.onekey.wallet');

  const metroUrl = process.env.METRO_URL || 'http://localhost:8081';
  const metroBundleUrl =
    process.env.METRO_BUNDLE_URL ||
    `${String(metroUrl).replace(
      /\/$/,
      '',
    )}/.expo/.virtual-metro-entry.bundle?platform=${metroPlatform}&dev=true&lazy=true&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&app=${metroAppId}`;

  await waitForMetroReady({ metroUrl });
  await warmUpMetroBundle({
    bundleUrl: metroBundleUrl,
    timeoutMs:
      Number(process.env.METRO_BUNDLE_WARMUP_TIMEOUT_MS) || 5 * 60 * 1000,
  });
};
