#!/usr/bin/env node

/*
 * Cross-branch Account Selector performance baseline (v6).
 *
 * Purpose
 * -------
 * Measures what a fixed set of account-selector interactions costs on the web
 * app, on two dimensions per React commit:
 *   - commits:             top-level React commit count (v1 metric, kept)
 *   - rendered components: how many composite components performed work inside
 *     each commit, counted the way React DevTools detects rendered fibers
 *     (fiber.flags & PerformedWork). This resolves optimizations that reduce
 *     re-renders WITHIN a commit (subscription isolation, stable identities),
 *     which the commit count alone cannot see.
 * Best-effort, it also sums React's profiling actualDuration per commit:
 * installing a devtools hook before the bundle loads makes React dev builds
 * create roots in ProfileMode, so fiber.actualDuration is populated. If it is
 * not, the artifact reports it as unavailable instead of faking it.
 *
 * Phases:
 *   - account-switch:      open the account selector and pick the other account
 *   - network-switch:      toggle evm--1 <-> btc--0 through the network trigger
 *   - selector-open-close: open the account selector and dismiss it
 *   - swap-num-0/1:       mount and dismiss each Swap selector slot
 *   - discover matrix:    mount 1/2/8 enabled nums and 2 origins x 2 nums
 *   - tab-switch:          Wallet <-> Trade sidebar tab round trip
 *   - background-churn:    first pin a canonical account/network state, then
 *     emit AccountUpdate on the app event bus repeatedly with NOTHING changed
 *     in the data. Each measured emit must start and complete at least one
 *     active-account rebuild; the artifact records those probe deltas.
 * Interactive phases first run 1 unmeasured warm-up iteration (v3: the first
 * pass through a phase pays one-time lazy-mount spikes that distorted v2
 * medians), then RENDER_BASELINE_ITERATIONS measured iterations (default 5);
 * background-churn performs RENDER_BASELINE_CHURN_EMITS emits (default 11),
 * one measured iteration per emit and no warm-up (its first emit shows no
 * systematic spike).
 *
 * Fixture: 3 HD wallets x 2 indexed accounts (public BIP39 test mnemonics),
 * chain accounts on evm--1 + btc--0 with the default derive type = 12 chain
 * accounts, so account-selector lists and consumers have realistic breadth.
 *
 * Zero intrusion
 * --------------
 * The app is never modified and no in-repo instrumentation is required:
 * everything is counted by installing a minimal __REACT_DEVTOOLS_GLOBAL_HOOK__
 * via Playwright's context.addInitScript BEFORE any page script runs (React
 * binds to whatever hook exists at load time), and long tasks come from a
 * PerformanceObserver installed the same way. Every selector, testID,
 * background API, event-bus global and storage key used below exists on
 * origin/x as well as on feature branches, and this file deliberately requires
 * nothing from the repo besides the root-level playwright-core dependency.
 *
 * Cross-commit comparison
 * -----------------------
 * Use `yarn test:e2e:web:render-baseline:compare`. The driver propagates this
 * exact harness into both commit clones, validates strict comparability, and
 * aggregates balanced paired samples. Running this file directly is intended
 * only for harness development.
 *
 * Comparability caveats
 * ---------------------
 * Numbers are comparable only between runs on the SAME machine, with the SAME
 * headless setting (WEB_E2E_HEADLESS) and under similar machine load. Each
 * measured slice starts after hard commit quiescence, records an intermediate
 * next-paint checkpoint, and ends at hard quiescence after the asserted flow
 * result. This preserves user-visible early cost without dropping delayed
 * commits caused by the operation. actualDuration and wall ms remain secondary
 * signals. The fiber walk in
 * onCommitFiberRoot costs the same on both branches (symmetric overhead), but
 * it runs on the main thread inside commit processing, so it inflates the
 * long-task counter; long tasks are still recorded but should not be compared
 * against v1 runs or treated as a primary signal.
 */

const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const { chromium } = require('playwright-core');

const repoRoot = path.resolve(__dirname, '../../..');
const artifactDir =
  process.env.RENDER_BASELINE_ARTIFACT_DIR ||
  path.join(repoRoot, '.tmp', 'render-baseline');

// Bumped whenever the measurement protocol changes in a way that shifts the
// numbers: v3 added warm-up iterations, v4 pinned a canonical background-churn
// state, v5 added retention/responsiveness probes, and v6 added hard
// quiescence, operation-to-quiescence windows with next-paint checkpoints, and
// the scene/num/origin matrix. Artifacts
// from different metricsVersions describe different protocols and must never
// be compared value-to-value - re-measure both sides instead (which is what
// the A/B driver does on every run).
const METRICS_VERSION = 6;

const RENDERER_TIMEOUT_MS =
  Number(process.env.WEB_E2E_RENDERER_TIMEOUT_MS) || 180_000;
const PAGE_TIMEOUT_MS = Number(process.env.WEB_E2E_PAGE_TIMEOUT_MS) || 120_000;
const FIXTURE_DB_TIMEOUT_MS = 30_000;
const ITERATIONS = Number(process.env.RENDER_BASELINE_ITERATIONS) || 5;
// v3: unmeasured warm-up iterations before each interactive phase's measured
// iterations. The first pass through a phase systematically pays one-time
// lazy-mount spikes (modal contents, tab pages), which distorted v2 medians;
// warming the phase up removes that spike from the measured samples.
// background-churn opts out (its first emit shows no systematic spike).
const WARMUP_ITERATIONS = 1;
// Commit quiescence: a phase (or the pre-phase settle) is considered rendered
// out when no new React commit landed for this long.
const QUIET_MS = Number(process.env.RENDER_BASELINE_QUIET_MS) || 800;
const QUIESCENCE_TIMEOUT_MS =
  Number(process.env.RENDER_BASELINE_QUIESCENCE_TIMEOUT_MS) || 30_000;
// Fixed settle between phases, before the quiescence wait takes over.
const PHASE_SETTLE_MS = Number(process.env.RENDER_BASELINE_SETTLE_MS) || 1000;
// background-churn: emits per run and the fixed post-emit window that lets the
// throttled reload (150ms trailing on both branches) fire before the
// quiescence wait takes over. Combined with the settle + quiescence between
// iterations, consecutive emits are spaced well beyond the reload throttle,
// so every emit triggers its own full reload cycle.
const CHURN_EMITS = Number(process.env.RENDER_BASELINE_CHURN_EMITS) || 11;
const CHURN_POST_EMIT_WAIT_MS = 500;
const RETENTION_ITERATIONS =
  Number(process.env.RENDER_BASELINE_RETENTION_ITERATIONS) || 7;
const OPERATION_WINDOW = 'operation-to-hard-quiescence';

function resolveScenarioProfile(value) {
  const profile = value || 'matrix';
  if (!['core', 'matrix'].includes(profile)) {
    throw new Error(
      `RENDER_BASELINE_SCENARIO_PROFILE=${profile} must be "core" or "matrix"`,
    );
  }
  return profile;
}

function buildScenarioMatrix(profile) {
  const core = [
    { enabledNums: [0], sceneName: 'home', scenario: 'account-switch' },
    { enabledNums: [0], sceneName: 'home', scenario: 'network-switch' },
    { enabledNums: [0], sceneName: 'home', scenario: 'selector-open-close' },
    { enabledNums: [0], sceneName: 'home', scenario: 'selector-retention' },
    { enabledNums: [0], sceneName: 'home', scenario: 'tab-switch' },
    { enabledNums: [0], sceneName: 'home', scenario: 'background-churn' },
  ];
  if (profile === 'core') {
    return core;
  }
  return [
    ...core,
    { enabledNums: [0], sceneName: 'swap', scenario: 'selector-open-close' },
    { enabledNums: [1], sceneName: 'swap', scenario: 'selector-open-close' },
    {
      enabledNums: [0],
      originCount: 1,
      sceneName: 'discover',
      scenario: 'connection-list-open-close',
    },
    {
      enabledNums: [0, 1],
      originCount: 1,
      sceneName: 'discover',
      scenario: 'connection-list-open-close',
    },
    {
      enabledNums: Array.from({ length: 8 }, (_, index) => index),
      originCount: 1,
      sceneName: 'discover',
      scenario: 'connection-list-open-close',
    },
    {
      enabledNums: [0, 1],
      originCount: 2,
      sceneName: 'discover',
      scenario: 'connection-list-open-close',
    },
  ];
}

const SCENARIO_PROFILE = resolveScenarioProfile(
  process.env.RENDER_BASELINE_SCENARIO_PROFILE,
);
const SCENARIO_MATRIX = buildScenarioMatrix(SCENARIO_PROFILE);

// Public BIP39 test vectors (Trezor/BIP39 reference data) - NOT secrets and
// never holding funds. Fixed mnemonics keep account names, addresses and list
// contents identical across branches so render costs are comparable.
const PUBLIC_TEST_MNEMONICS = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'legal winner thank year wave sausage worth useful legal winner thank yellow',
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
];

function resolveFixtureScale({ accountsPerWallet, walletCount } = {}) {
  const resolvedAccountsPerWallet = Number(accountsPerWallet || 2);
  const resolvedWalletCount = Number(
    walletCount || PUBLIC_TEST_MNEMONICS.length,
  );
  if (
    !Number.isInteger(resolvedAccountsPerWallet) ||
    resolvedAccountsPerWallet < 2 ||
    resolvedAccountsPerWallet > 100
  ) {
    throw new Error(
      `accountsPerWallet must be an integer from 2 to 100, received ${accountsPerWallet}`,
    );
  }
  if (
    !Number.isInteger(resolvedWalletCount) ||
    resolvedWalletCount < 1 ||
    resolvedWalletCount > PUBLIC_TEST_MNEMONICS.length
  ) {
    throw new Error(
      `walletCount must be an integer from 1 to ${PUBLIC_TEST_MNEMONICS.length}, ` +
        `received ${walletCount}`,
    );
  }
  return {
    accountsPerWallet: resolvedAccountsPerWallet,
    walletCount: resolvedWalletCount,
  };
}

const FIXTURE_SCALE = resolveFixtureScale({
  accountsPerWallet: process.env.RENDER_BASELINE_ACCOUNTS_PER_WALLET,
  walletCount: process.env.RENDER_BASELINE_WALLET_COUNT,
});

// Every value below is verified to exist on origin/x AND current branches.
const WALLET_MODE_STORAGE_KEY = '$onekey_web_dapp_mode';
const TEST_IDS = {
  accountItem: (index) => `account-item-index-${index}`,
  accountTrigger: 'AccountSelectorTriggerBase',
  dappAccountListItem: 'dapp-connection-account-list-item',
  dappConnectionList: 'dapp-connection-list',
  dappConnectionListItem: 'dapp-connection-list-item',
  networkTrigger: 'account-network-trigger-button',
  networkTriggerText: 'account-network-trigger-button-text',
  walletItem: (walletId) => `wallet-${walletId}`,
  walletList: 'account-selector-wallet-list',
};
const ONBOARDING_CLOSE_SELECTOR =
  '[data-testid="page-close-trigger"]:visible, ' +
  '[data-testid="onboardingv2-handle-back-icon-btn"]:visible, ' +
  '[data-testid="onboarding-layout-header-back-btn"]:visible, ' +
  '[data-testid="onboarding-icon-btn"]:visible';
// SegmentControl tab label inside the unified network selector; the label
// string is stable in en_US on both branches while the tab's testID is not.
const SINGLE_NETWORK_TAB_LABEL = 'Single network';
const NETWORK_IDS = ['evm--1', 'btc--0'];
const MATRIX_DAPP_ORIGINS = [
  'https://render-baseline-primary.test',
  'https://render-baseline-secondary.test',
];
const CHURN_STATE = {
  accountIndex: 0,
  networkId: NETWORK_IDS[0],
};

function log(message) {
  console.log(`[render-baseline] ${message}`);
}

function yarnBin() {
  return process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
}

function getDevOnlyPassword() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}-onekey-debug`;
}

function gitInfo() {
  const read = (args) => {
    try {
      return execFileSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim();
    } catch {
      return 'unknown';
    }
  };
  return {
    branch: read(['rev-parse', '--abbrev-ref', 'HEAD']),
    sha: read(['rev-parse', '--short', 'HEAD']),
  };
}

// ---------------------------------------------------------------------------
// Renderer + browser launch (self-contained copy of the web E2E launcher so
// this file works on branches where local-secret-envelope.e2e.js exports
// nothing and runs its own test on require).
// ---------------------------------------------------------------------------

function appendOutput(buffer, chunk) {
  const value = `${buffer}${chunk.toString()}`;
  return value.length > 8000 ? value.slice(value.length - 8000) : value;
}

function httpOk(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(
        Boolean(response.statusCode) &&
          response.statusCode >= 200 &&
          response.statusCode < 500,
      );
    });
    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available web E2E port near ${startPort}`);
}

async function waitForRenderer(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(
        `Web dev server exited early with code ${child.exitCode}`,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    if (await httpOk(url)) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for web dev server at ${url}`);
}

async function startWebRenderer() {
  const externalRendererUrl = process.env.WEB_E2E_RENDERER_URL;
  if (externalRendererUrl) {
    const rendererUrl = new URL(externalRendererUrl).toString();
    log(`reuse renderer at ${rendererUrl}`);
    await waitForRenderer(rendererUrl, undefined, RENDERER_TIMEOUT_MS);
    return { child: undefined, rendererUrl };
  }

  const preferredPort = Number(process.env.WEB_E2E_PORT) || 3201;
  const port = await findAvailablePort(preferredPort);
  const rendererUrl = `http://localhost:${port}/`;

  log(`start renderer on ${rendererUrl}`);
  const child = spawn(
    yarnBin(),
    ['workspace', '@onekeyhq/web', 'exec', 'rspack', 'serve'],
    {
      cwd: repoRoot,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        BROWSER: 'none',
        E2E_MODE: 'true',
        NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=10240',
        TRANSFORM_REGENERATOR_DISABLED: 'true',
        WEB_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let output = '';
  child.stdout.on('data', (chunk) => {
    output = appendOutput(output, chunk);
    if (process.env.WEB_E2E_VERBOSE) {
      process.stdout.write(chunk);
    }
  });
  child.stderr.on('data', (chunk) => {
    output = appendOutput(output, chunk);
    if (process.env.WEB_E2E_VERBOSE) {
      process.stderr.write(chunk);
    }
  });

  try {
    await waitForRenderer(rendererUrl, child, RENDERER_TIMEOUT_MS);
  } catch (error) {
    await stopProcess(child);
    throw new Error(`${error.message}\n\nRenderer output tail:\n${output}`, {
      cause: error,
    });
  }

  return { child, rendererUrl };
}

async function stopProcess(child) {
  if (!child || child.killed) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      child.kill();
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch (_) {
    try {
      child.kill('SIGTERM');
    } catch (_e) {
      // ignore cleanup errors
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (child.exitCode === null) {
    try {
      if (process.platform === 'win32') {
        child.kill('SIGKILL');
      } else {
        process.kill(-child.pid, 'SIGKILL');
      }
    } catch (_) {
      // ignore cleanup errors
    }
  }
}

function getChromeExecutablePath() {
  if (process.env.WEB_E2E_BROWSER_EXECUTABLE) {
    return process.env.WEB_E2E_BROWSER_EXECUTABLE;
  }
  if (process.platform === 'darwin') {
    const chromePath =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  return undefined;
}

function parseBooleanEnv(value, fallbackValue) {
  if (value === undefined) {
    return fallbackValue;
  }
  const normalizedValue = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', ''].includes(normalizedValue)) {
    return false;
  }
  throw new Error(`Invalid boolean value "${value}".`);
}

function shouldRunHeadless() {
  const isCI = parseBooleanEnv(process.env.CI, false);
  return parseBooleanEnv(process.env.WEB_E2E_HEADLESS, isCI);
}

async function launchBrowser() {
  const executablePath = getChromeExecutablePath();
  if (!executablePath) {
    throw new Error(
      'No browser executable found. Set WEB_E2E_BROWSER_EXECUTABLE to run web E2E.',
    );
  }
  const headless = shouldRunHeadless();
  log(`launch browser in ${headless ? 'headless' : 'headed'} mode`);
  return chromium.launch({
    args: ['--no-sandbox'],
    executablePath,
    headless,
  });
}

// ---------------------------------------------------------------------------
// Injection-only measurement
// ---------------------------------------------------------------------------

// Runs before ANY page script. React's reconciler binds to whatever
// __REACT_DEVTOOLS_GLOBAL_HOOK__ exists at bundle evaluation time; every hook
// call site in React is wrapped in try/catch, so this minimal surface cannot
// break the app. react-refresh (dev builds) wraps hook.inject and
// hook.onCommitFiberRoot but chains to the originals, so counting survives it;
// it also iterates hook.renderers, hence the real Map.
//
// Because the hook exists before react-dom evaluates, React's dev build also
// creates roots in ProfileMode (createHostRootFiber ORs ProfileMode in when
// isDevToolsPresent), which populates fiber.actualDuration; identical on both
// branches, so the profiling overhead is symmetric too.
function installRenderBaselineHook() {
  const state = {
    actualDurationMs: 0,
    // Append-only per-commit logs so the driver can compute per-commit and
    // per-slice stats. A run produces a few thousand commits; the cap only
    // guards against a pathological run growing without bound.
    commitDurationsMs: [],
    commitRenderedCounts: [],
    commits: 0,
    commitsMissingDuration: 0,
    interactionDurationsMs: [],
    longAnimationFrameDurationsMs: [],
    longTasks: 0,
    renderedComponents: 0,
    walkErrors: 0,
    walkOverflows: 0,
  };
  const MAX_COMMIT_LOG = 100_000;
  const WALK_NODE_BUDGET = 200_000;

  // Counts composite components that rendered in THIS commit, the way React
  // DevTools does: a visited composite fiber rendered iff its PerformedWork
  // flag (0b1; fiber.effectTag on React <17) is set (didFiberRender), and -
  // critically - the walk descends only where `next.child !== prev.child`
  // relative to the fiber's alternate (updateFiberRecursively's gate).
  // Subtrees reused without cloning keep stale PerformedWork bits from older
  // commits; the alternate diff stops exactly at the never-worked clones above
  // them, so stale bits are never visited. Fibers without an alternate are
  // newly mounted this commit: every composite in such a subtree is counted,
  // matching DevTools' mount semantics. Only composite component fibers count -
  // FunctionComponent(0), ClassComponent(1), ForwardRef(11), MemoComponent(14)
  // and SimpleMemoComponent(15) - host/host-root fibers are excluded. The walk
  // is iterative (explicit stack, no recursion) and capped so a pathological
  // tree cannot hang the page; its cost is identical on both branches
  // (symmetric overhead), but it does pollute the long-task counter.
  function countRenderedComposites(rootFiber) {
    const PERFORMED_WORK = 0b1;
    const isCountedTag = (tag) =>
      tag === 0 || tag === 1 || tag === 11 || tag === 14 || tag === 15;
    const didRender = (fiber) => {
      const flags = fiber.flags === undefined ? fiber.effectTag : fiber.flags;
      return (flags & PERFORMED_WORK) !== 0;
    };
    let rendered = 0;
    let visited = 0;
    // Stack entries: [nextFiber, prevFiber] pairs for updated subtrees, or
    // [nextFiber, null] inside newly mounted subtrees.
    const stack = [[rootFiber, rootFiber.alternate || null]];
    while (stack.length) {
      visited += 1;
      if (visited > WALK_NODE_BUDGET) {
        state.walkOverflows += 1;
        break;
      }
      const [next, prev] = stack.pop();
      if (!prev) {
        if (isCountedTag(next.tag)) {
          rendered += 1;
        }
        for (let child = next.child; child; child = child.sibling) {
          stack.push([child, null]);
        }
      } else {
        if (isCountedTag(next.tag) && didRender(next)) {
          rendered += 1;
        }
        if (next.child !== prev.child) {
          for (let child = next.child; child; child = child.sibling) {
            stack.push([child, child.alternate || null]);
          }
        }
      }
    }
    return rendered;
  }

  function recordCommit(root) {
    state.commits += 1;
    try {
      const rootFiber = root && root.current;
      if (!rootFiber) {
        return;
      }
      const rendered = countRenderedComposites(rootFiber);
      state.renderedComponents += rendered;
      if (state.commitRenderedCounts.length < MAX_COMMIT_LOG) {
        state.commitRenderedCounts.push(rendered);
      }
      // In ProfileMode the finished HostRoot fiber's actualDuration is the
      // render time of this commit: createWorkInProgress resets it to 0 and
      // completeWork bubbles rendered children's durations up the spine.
      const duration = rootFiber.actualDuration;
      const hasDuration =
        typeof duration === 'number' && Number.isFinite(duration);
      if (hasDuration) {
        state.actualDurationMs += duration;
      } else {
        state.commitsMissingDuration += 1;
      }
      if (state.commitDurationsMs.length < MAX_COMMIT_LOG) {
        state.commitDurationsMs.push(hasDuration ? duration : -1);
      }
    } catch {
      state.walkErrors += 1;
    }
  }

  let nextRendererId = 1;
  const hook = {
    checkDCE() {},
    emit() {},
    inject(internals) {
      const id = nextRendererId;
      nextRendererId += 1;
      hook.renderers.set(id, internals);
      return id;
    },
    isDisabled: false,
    off() {},
    on() {},
    onCommitFiberRoot(_id, root) {
      recordCommit(root);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    renderers: new Map(),
    setStrictMode() {},
    sub() {
      return () => {};
    },
    supportsFiber: true,
  };
  if (!globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  } else {
    // A real devtools hook is already installed (headed run with the
    // extension); piggyback on it instead of replacing it.
    const existing = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const original = existing.onCommitFiberRoot;
    existing.onCommitFiberRoot = function onCommitFiberRoot(...args) {
      recordCommit(args[1]);
      return typeof original === 'function'
        ? original.apply(this, args)
        : undefined;
    };
  }
  try {
    new PerformanceObserver((list) => {
      state.longTasks += list.getEntries().length;
    }).observe({ entryTypes: ['longtask'] });
  } catch {
    // long-task observer unsupported: counts stay 0
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (
          state.interactionDurationsMs.length < MAX_COMMIT_LOG &&
          entry.interactionId > 0
        ) {
          state.interactionDurationsMs.push(entry.duration);
        }
      }
    }).observe({ durationThreshold: 16, type: 'event' });
  } catch {
    // Event Timing is optional; the artifact exposes an empty distribution.
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (state.longAnimationFrameDurationsMs.length < MAX_COMMIT_LOG) {
          state.longAnimationFrameDurationsMs.push(entry.duration);
        }
      }
    }).observe({ type: 'long-animation-frame' });
  } catch {
    // Long Animation Frames are optional on older Chrome versions.
  }
  globalThis.__renderBaseline = {
    get actualDurationMs() {
      return state.actualDurationMs;
    },
    get commitDurationsMs() {
      return state.commitDurationsMs;
    },
    get commitRenderedCounts() {
      return state.commitRenderedCounts;
    },
    get commits() {
      return state.commits;
    },
    get commitsMissingDuration() {
      return state.commitsMissingDuration;
    },
    get longTasks() {
      return state.longTasks;
    },
    get interactionDurationsMs() {
      return state.interactionDurationsMs;
    },
    get longAnimationFrameDurationsMs() {
      return state.longAnimationFrameDurationsMs;
    },
    mark(name) {
      globalThis.__renderBaseline.marks.push({
        commits: state.commits,
        longTasks: state.longTasks,
        name: String(name),
        renderedComponents: state.renderedComponents,
        tMs: Math.round(globalThis.performance.now()),
      });
    },
    marks: [],
    get renderedComponents() {
      return state.renderedComponents;
    },
    get walkErrors() {
      return state.walkErrors;
    },
    get walkOverflows() {
      return state.walkOverflows;
    },
  };
}

async function readCounters(page) {
  return page.evaluate(() => ({
    actualDurationMs: globalThis.__renderBaseline.actualDurationMs,
    commitLogLength: globalThis.__renderBaseline.commitRenderedCounts.length,
    commits: globalThis.__renderBaseline.commits,
    commitsMissingDuration: globalThis.__renderBaseline.commitsMissingDuration,
    interactionLogLength:
      globalThis.__renderBaseline.interactionDurationsMs.length,
    longAnimationFrameLogLength:
      globalThis.__renderBaseline.longAnimationFrameDurationsMs.length,
    longTasks: globalThis.__renderBaseline.longTasks,
    renderedComponents: globalThis.__renderBaseline.renderedComponents,
    walkErrors: globalThis.__renderBaseline.walkErrors,
    walkOverflows: globalThis.__renderBaseline.walkOverflows,
  }));
}

async function readCommitRenderedSlice(page, fromIndex, toIndex) {
  return page.evaluate(
    ({ from, to }) =>
      globalThis.__renderBaseline.commitRenderedCounts.slice(from, to),
    { from: fromIndex, to: toIndex },
  );
}

async function readPerformanceSlice(page, key, fromIndex, toIndex) {
  return page.evaluate(
    ({ from, metricKey, to }) =>
      globalThis.__renderBaseline[metricKey].slice(from, to),
    { from: fromIndex, metricKey: key, to: toIndex },
  );
}

function diffResourceSnapshots(before, after) {
  return {
    retainedDocuments: Math.max(0, after.documents - before.documents),
    retainedDomNodes: Math.max(0, after.domNodes - before.domNodes),
    retainedEventListeners: Math.max(
      0,
      after.eventListeners - before.eventListeners,
    ),
    retainedJsHeapBytes: Math.max(
      0,
      after.jsHeapUsedBytes - before.jsHeapUsedBytes,
    ),
  };
}

async function createResourceSnapshotProbe(context, page) {
  const session = await context.newCDPSession(page);
  await session.send('HeapProfiler.enable');
  return {
    async dispose() {
      await session.detach();
    },
    async read() {
      await session.send('HeapProfiler.collectGarbage');
      const [dom, heap] = await Promise.all([
        session.send('Memory.getDOMCounters'),
        session.send('Runtime.getHeapUsage'),
      ]);
      return {
        documents: dom.documents,
        domNodes: dom.nodes,
        eventListeners: dom.jsEventListeners,
        jsHeapUsedBytes: heap.usedSize,
      };
    },
  };
}

async function waitForCommitQuiescence(
  page,
  { quietMs = QUIET_MS, timeoutMs = QUIESCENCE_TIMEOUT_MS } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let last = (await readCounters(page)).commits;
  let quietSince = Date.now();
  while (Date.now() < deadline) {
    await page.waitForTimeout(100);
    const current = (await readCounters(page)).commits;
    if (current !== last) {
      last = current;
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= quietMs) {
      return;
    }
  }
  throw new Error(
    `Commit quiescence was not reached within ${timeoutMs}ms; ` +
      'the measurement window is contaminated by unrelated work',
  );
}

async function waitForNextPaint(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        globalThis.requestAnimationFrame(() => {
          globalThis.requestAnimationFrame(resolve);
        });
      }),
  );
}

async function markOperation(page, operationId, edge) {
  await page.evaluate(
    ({ id, operationEdge }) => {
      globalThis.__renderBaseline.mark(`${id}:${operationEdge}`);
    },
    { id: operationId, operationEdge: edge },
  );
}

// ---------------------------------------------------------------------------
// App helpers (selectors valid on both origin/x and feature branches)
// ---------------------------------------------------------------------------

function visibleTestID(testID) {
  return `[data-testid=${JSON.stringify(testID)}]:visible`;
}

async function clickTestID(page, testID) {
  const locator = page.locator(visibleTestID(testID)).first();
  await locator.waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
  await locator.click({ timeout: PAGE_TIMEOUT_MS });
}

async function waitForHiddenTestID(page, testID, timeoutMs = PAGE_TIMEOUT_MS) {
  const locator = page.locator(visibleTestID(testID));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await locator.count()) === 0) {
      return;
    }
    await page.waitForTimeout(50);
  }
  assert.fail(`testID ${testID} remained visible`);
}

function getSidebarTab(page, label) {
  return page
    .locator('.sidebar-tab-item')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
}

async function waitForAppReady(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E &&
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceAccount,
      ),
    undefined,
    { timeout: PAGE_TIMEOUT_MS },
  );
}

async function waitForHomeShell(page) {
  const onboardingClose = page.locator(ONBOARDING_CLOSE_SELECTOR);
  const homeTab = getSidebarTab(page, 'Wallet');
  const accountTrigger = page.locator(visibleTestID(TEST_IDS.accountTrigger));
  const deadline = Date.now() + PAGE_TIMEOUT_MS;
  let stableSince;
  while (Date.now() < deadline) {
    if (await onboardingClose.count()) {
      stableSince = undefined;
      await onboardingClose
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
    } else {
      if (await accountTrigger.count()) {
        stableSince ??= Date.now();
        if (Date.now() - stableSince >= 2000) {
          return;
        }
      } else {
        stableSince = undefined;
        if (await homeTab.count()) {
          await homeTab.click({ timeout: 5000 }).catch(() => {});
        }
      }
    }
    await page.waitForTimeout(250);
  }
  assert.fail('Home shell (account selector trigger) never became stable');
}

async function waitForPersistedSelection(
  page,
  expected,
  { num = 0, sceneName = 'home', sceneUrl } = {},
) {
  await page.waitForFunction(
    async ({
      expectedSelection,
      selectionNum,
      selectionSceneName,
      selectionSceneUrl,
    }) => {
      const simpleDb = globalThis.$$appGlobals.$backgroundApiProxy.simpleDb;
      const selected =
        selectionSceneName === 'discover' && selectionSceneUrl
          ? (
              await simpleDb.dappConnection.getAccountSelectorMap({
                sceneUrl: selectionSceneUrl,
              })
            )?.[selectionNum]
          : await simpleDb.accountSelector.getSelectedAccount({
              num: selectionNum,
              sceneName: selectionSceneName,
              sceneUrl: selectionSceneUrl,
            });
      if (!selected) return false;
      return Object.entries(expectedSelection).every(
        ([key, value]) => selected[key] === value,
      );
    },
    {
      expectedSelection: expected,
      selectionNum: num,
      selectionSceneName: sceneName,
      selectionSceneUrl: sceneUrl,
    },
    { timeout: PAGE_TIMEOUT_MS },
  );
}

// ---------------------------------------------------------------------------
// Fixture defaults to 3 HD wallets x 2 indexed accounts, with scale knobs for
// validating how update and render cost grows with larger account lists.
// Everything runs through background APIs that exist on origin/x. The app
// auto-selects the newest wallet's first account, so the LAST created wallet
// is the primary wallet the measured flows operate on; the other two keep the
// selector lists and their consumers populated.
// ---------------------------------------------------------------------------

async function createFixture(page, devOnlyPassword) {
  return page.evaluate(
    async ({
      accountsPerWallet,
      fixtureDbTimeoutMs,
      mnemonics,
      networkIds,
      password,
    }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const e2eParams = { $$devOnlyPassword: password };
      await api.serviceE2E.clearWalletsAndAccounts(e2eParams);
      await api.serviceE2E.clearPassword(e2eParams);

      const rawPassword = `E2E-${globalThis.crypto.randomUUID()}-aA1!`;
      const encodedPassword = await api.servicePassword.encodeSensitiveText({
        text: rawPassword,
      });
      await api.servicePassword.setPassword(encodedPassword, 'password');

      const waitForIndexedAccount = async (indexedAccountId) => {
        const deadline = Date.now() + fixtureDbTimeoutMs;
        while (Date.now() < deadline) {
          const indexedAccount = await api.serviceAccount.getIndexedAccountSafe(
            { id: indexedAccountId },
          );
          if (indexedAccount) {
            return indexedAccount;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error(`Indexed account ${indexedAccountId} not readable`);
      };

      const wallets = [];
      for (const [walletIndex, mnemonic] of mnemonics.entries()) {
        const encodedMnemonic = await api.servicePassword.encodeSensitiveText({
          text: mnemonic,
        });
        const created = await api.serviceAccount.createHDWallet({
          isWalletBackedUp: true,
          mnemonic: encodedMnemonic,
          name: `Render Baseline ${walletIndex + 1}`,
        });
        const walletId = created.wallet.id;

        await waitForIndexedAccount(created.indexedAccount.id);
        const indexedAccountIds = [created.indexedAccount.id];
        for (
          let accountIndex = 1;
          accountIndex < accountsPerWallet;
          accountIndex += 1
        ) {
          const next = await api.serviceAccount.addHDNextIndexedAccount({
            walletId,
          });
          indexedAccountIds.push(next.indexedAccountId);
        }
        const accountNames = [];
        for (const indexedAccountId of indexedAccountIds) {
          const indexedAccount = await waitForIndexedAccount(indexedAccountId);
          accountNames.push(indexedAccount.name);
          for (const networkId of networkIds) {
            const deriveItems =
              await api.serviceNetwork.getDeriveInfoItemsOfNetwork({
                networkId,
              });
            if (!deriveItems.length) {
              throw new Error(`Network ${networkId} has no derive items`);
            }
            // The default derive type keeps fixture growth proportional to the
            // wallet/account/network axes instead of derive-type breadth.
            await api.serviceAccount.addHDOrHWAccounts({
              deriveType: deriveItems[0].value,
              indexedAccountId,
              networkId,
              walletId,
            });
          }
        }
        wallets.push({ accountNames, indexedAccountIds, walletId });
      }

      const networkNames = {};
      for (const networkId of networkIds) {
        const network = await api.serviceNetwork.getNetworkSafe({ networkId });
        if (!network?.name) {
          throw new Error(`Network ${networkId} has no name`);
        }
        networkNames[networkId] = network.name;
      }

      return {
        networkNames,
        rawPassword,
        wallets,
      };
    },
    {
      accountsPerWallet: FIXTURE_SCALE.accountsPerWallet,
      fixtureDbTimeoutMs: FIXTURE_DB_TIMEOUT_MS,
      mnemonics: PUBLIC_TEST_MNEMONICS.slice(0, FIXTURE_SCALE.walletCount),
      networkIds: NETWORK_IDS,
      password: devOnlyPassword,
    },
  );
}

// A page reload restarts the in-memory wallet password cache; re-verify the
// fixture password so no passcode prompt interrupts the measured flows.
async function restoreWalletPasswordCache(page, fixture) {
  await page.evaluate(
    async ({ rawPassword }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const encoded = await api.servicePassword.encodeSensitiveText({
        text: rawPassword,
      });
      await api.servicePassword.verifyPassword({
        password: encoded,
        passwordMode: 'password',
        skipPostVerifyBackgroundTasks: true,
      });
    },
    { rawPassword: fixture.rawPassword },
  );
}

// The app auto-selects the first account after wallet creation and defaults
// the fresh home scene to All Networks, overwriting any selection written
// directly to simpleDb. In All Networks mode the header trigger has no
// cross-branch testID, so escape it once (unmeasured) through the unified
// network selector: prefer the single-network trigger when it is already
// visible, otherwise push the selector's own modal route - the exact call the
// trigger's onPress makes - which is stable on both branches.
async function pinHomeToSingleNetwork(page, fixture, networkId) {
  const singleTrigger = page.locator(visibleTestID(TEST_IDS.networkTrigger));
  if (await singleTrigger.count()) {
    await singleTrigger.first().click({ timeout: PAGE_TIMEOUT_MS });
  } else {
    await page.evaluate(() => {
      globalThis.$$appGlobals.$rootAppNavigation.pushModal(
        'ChainSelectorModal',
        {
          params: { editable: true, num: 0, sceneName: 'home' },
          screen: 'UnifiedNetworkSelector',
        },
      );
    });
  }
  const networkRow = page.locator(
    `${visibleTestID(networkId)}, ${visibleTestID(`select-item-${networkId}`)}`,
  );
  try {
    await networkRow.first().waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    await page
      .getByText(SINGLE_NETWORK_TAB_LABEL, { exact: true })
      .first()
      .click({ timeout: PAGE_TIMEOUT_MS });
    await networkRow.first().waitFor({
      state: 'visible',
      timeout: PAGE_TIMEOUT_MS,
    });
  }
  await networkRow.first().click({ timeout: PAGE_TIMEOUT_MS });
  await waitForPersistedSelection(page, { networkId });
  await page
    .locator(visibleTestID(TEST_IDS.networkTrigger))
    .first()
    .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
  await page.waitForFunction(
    ({ expectedName, selector }) => {
      const node = globalThis.document.querySelector(selector);
      return Boolean(node && node.textContent?.includes(expectedName));
    },
    {
      expectedName: fixture.networkNames[networkId],
      selector: `[data-testid=${JSON.stringify(TEST_IDS.networkTriggerText)}]`,
    },
    { timeout: PAGE_TIMEOUT_MS },
  );
}

// ---------------------------------------------------------------------------
// Measured flows
// ---------------------------------------------------------------------------

async function openAccountSelector(page) {
  await clickTestID(page, TEST_IDS.accountTrigger);
  await page
    .locator(visibleTestID(TEST_IDS.walletList))
    .first()
    .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
}

async function closeAccountSelector(page) {
  await page.keyboard.press('Escape');
  const walletList = page.locator(visibleTestID(TEST_IDS.walletList));
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if ((await walletList.count()) === 0) {
      return;
    }
    await page.waitForTimeout(50);
  }
  // Escape did not land; use the modal close button instead.
  await page
    .locator('[data-testid="page-close-trigger"]:visible')
    .first()
    .click({ timeout: 5000 })
    .catch(() => {});
  await waitForHiddenTestID(page, TEST_IDS.walletList);
}

async function selectAccountByIndex(page, primaryWallet, targetIndex) {
  const targetName = primaryWallet.accountNames[targetIndex];
  await openAccountSelector(page);
  await clickTestID(page, TEST_IDS.walletItem(primaryWallet.walletId));
  await clickTestID(page, TEST_IDS.accountItem(targetIndex));
  await waitForHiddenTestID(page, TEST_IDS.walletList);
  await waitForPersistedSelection(page, {
    indexedAccountId: primaryWallet.indexedAccountIds[targetIndex],
  });
  // The desktop-web header renders the trigger in horizontal layout, and on
  // origin/x that layout's account label carries no "account-name" testID
  // (feature branches tag both layouts). Read the trigger container instead:
  // it exists on both branches and always wraps the displayed account label.
  await page.waitForFunction(
    ({ expectedName, selector }) => {
      const nodes = globalThis.document.querySelectorAll(selector);
      return Array.from(nodes).some((node) =>
        node.textContent?.includes(expectedName),
      );
    },
    {
      expectedName: targetName,
      selector: `[data-testid=${JSON.stringify(TEST_IDS.accountTrigger)}]`,
    },
    { timeout: PAGE_TIMEOUT_MS },
  );
}

async function flowAccountSwitch(page, primaryWallet, iteration) {
  const targetIndex = iteration % 2 === 0 ? 1 : 0;
  await selectAccountByIndex(page, primaryWallet, targetIndex);
}

async function selectNetworkById(page, fixture, targetNetworkId) {
  await clickTestID(page, TEST_IDS.networkTrigger);
  const networkRow = page.locator(
    `${visibleTestID(targetNetworkId)}, ${visibleTestID(
      `select-item-${targetNetworkId}`,
    )}`,
  );
  try {
    await networkRow.first().waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // The selector opened on the portfolio tab; move to the network tab. The
    // tab has no cross-branch testID, so the stable label text is used.
    await page
      .getByText(SINGLE_NETWORK_TAB_LABEL, { exact: true })
      .first()
      .click({ timeout: PAGE_TIMEOUT_MS });
    await networkRow.first().waitFor({
      state: 'visible',
      timeout: PAGE_TIMEOUT_MS,
    });
  }
  await networkRow.first().click({ timeout: PAGE_TIMEOUT_MS });
  await waitForPersistedSelection(page, { networkId: targetNetworkId });
  // The selector must dismiss and the trigger text must re-render to the new
  // network name before the phase ends.
  const deadline = Date.now() + PAGE_TIMEOUT_MS;
  while ((await networkRow.count()) > 0) {
    assert.ok(
      Date.now() < deadline,
      `Network selector stayed open after picking ${targetNetworkId}`,
    );
    await page.waitForTimeout(50);
  }
  await page.waitForFunction(
    ({ expectedName, selector }) => {
      const node = globalThis.document.querySelector(selector);
      return Boolean(node && node.textContent?.includes(expectedName));
    },
    {
      expectedName: fixture.networkNames[targetNetworkId],
      selector: `[data-testid=${JSON.stringify(TEST_IDS.networkTriggerText)}]`,
    },
    { timeout: PAGE_TIMEOUT_MS },
  );
}

async function flowNetworkSwitch(page, fixture, iteration) {
  const targetNetworkId = iteration % 2 === 0 ? NETWORK_IDS[1] : NETWORK_IDS[0];
  await selectNetworkById(page, fixture, targetNetworkId);
}

async function flowSelectorOpenClose(page) {
  await openAccountSelector(page);
  await closeAccountSelector(page);
}

async function openSceneAccountSelector(page, { num, sceneName, sceneUrl }) {
  await page.evaluate(
    ({ selectionNum, selectionSceneName, selectionSceneUrl }) => {
      globalThis.$$appGlobals.$rootAppNavigation.pushModal(
        'AccountManagerStacks',
        {
          params: {
            num: selectionNum,
            sceneName: selectionSceneName,
            sceneUrl: selectionSceneUrl,
          },
          screen: 'AccountSelectorStack',
        },
      );
    },
    {
      selectionNum: num,
      selectionSceneName: sceneName,
      selectionSceneUrl: sceneUrl,
    },
  );
  await page
    .locator(visibleTestID(TEST_IDS.walletList))
    .first()
    .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
}

async function closeSceneAccountSelector(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await waitForHiddenTestID(page, TEST_IDS.walletList);
  await page
    .locator(visibleTestID(TEST_IDS.accountTrigger))
    .first()
    .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
}

async function flowSceneSelectorOpenClose(page, config) {
  await openSceneAccountSelector(page, config);
  await closeSceneAccountSelector(page);
}

async function buildMatrixDAppAccountInfo(page, fixture) {
  const wallet = fixture.wallets[0];
  return page.evaluate(
    async ({ indexedAccountId, walletId }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const networkId = 'evm--1';
      const deriveType =
        (await api.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        })) ?? 'default';
      const { accounts } =
        await api.serviceAccount.getAccountsByIndexedAccounts({
          deriveType,
          indexedAccountIds: [indexedAccountId],
          networkId,
        });
      const account = accounts[0];
      if (!account?.id || !account.address) {
        throw new Error('Unable to build benchmark DApp account information');
      }
      return {
        accountId: account.id,
        address: account.address,
        deriveType,
        focusedWallet: walletId,
        indexedAccountId,
        networkId,
        networkImpl: 'evm',
        walletId,
      };
    },
    {
      indexedAccountId: wallet.indexedAccountIds[0],
      walletId: wallet.walletId,
    },
  );
}

async function clearMatrixDAppConnections(page) {
  await page.evaluate(
    async ({ origins }) => {
      const entity =
        globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection;
      await Promise.all(
        origins.map((origin) =>
          entity.deleteConnection(origin, 'injectedProvider'),
        ),
      );
    },
    { origins: MATRIX_DAPP_ORIGINS },
  );
}

async function configureMatrixDAppConnections(
  page,
  accountInfo,
  enabledNumCounts,
) {
  await clearMatrixDAppConnections(page);
  await page.evaluate(
    async ({ baseAccountInfo, counts, origins }) => {
      const entity =
        globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection;
      for (const [originIndex, enabledNumCount] of counts.entries()) {
        await entity.upsertConnection({
          accountsInfo: Array.from({ length: enabledNumCount }, () => ({
            ...baseAccountInfo,
          })),
          imageURL: '',
          origin: origins[originIndex],
          replaceExistAccount: true,
          storageType: 'injectedProvider',
        });
        const map = await entity.getAccountSelectorMap({
          sceneUrl: origins[originIndex],
        });
        if (Object.keys(map || {}).length !== enabledNumCount) {
          throw new Error(
            `Expected ${enabledNumCount} enabled nums for ${origins[originIndex]}`,
          );
        }
      }
    },
    {
      baseAccountInfo: accountInfo,
      counts: enabledNumCounts,
      origins: MATRIX_DAPP_ORIGINS,
    },
  );
  await waitForCommitQuiescence(page);
}

async function openMatrixDAppConnectionList(
  page,
  { accountCount, originCount },
) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pushModal(
      'DAppConnectionModal',
      { screen: 'ConnectionList' },
    );
  });
  await page
    .locator(visibleTestID(TEST_IDS.dappConnectionList))
    .first()
    .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
  await page.waitForFunction(
    ({ expectedAccounts, expectedOrigins, accountSelector, originSelector }) =>
      globalThis.document.querySelectorAll(accountSelector).length ===
        expectedAccounts &&
      globalThis.document.querySelectorAll(originSelector).length ===
        expectedOrigins,
    {
      accountSelector: `[data-testid=${JSON.stringify(TEST_IDS.dappAccountListItem)}]`,
      expectedAccounts: accountCount,
      expectedOrigins: originCount,
      originSelector: `[data-testid=${JSON.stringify(TEST_IDS.dappConnectionListItem)}]`,
    },
    { timeout: PAGE_TIMEOUT_MS },
  );
}

async function closeMatrixDAppConnectionList(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await waitForHiddenTestID(page, TEST_IDS.dappConnectionList);
  await page
    .locator(visibleTestID(TEST_IDS.accountTrigger))
    .first()
    .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
}

async function flowMatrixDAppConnectionListOpenClose(page, expected) {
  await openMatrixDAppConnectionList(page, expected);
  await closeMatrixDAppConnectionList(page);
}

async function flowTabSwitch(page) {
  const tradeTab = getSidebarTab(page, 'Trade');
  const walletTab = getSidebarTab(page, 'Wallet');
  await tradeTab.click({ timeout: PAGE_TIMEOUT_MS });
  await waitForCommitQuiescence(page);
  await walletTab.click({ timeout: PAGE_TIMEOUT_MS });
  await page
    .locator(visibleTestID(TEST_IDS.accountTrigger))
    .first()
    .waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
}

async function installReloadProbe(page) {
  await page.evaluate(() => {
    const proxy = globalThis.$$appGlobals.$backgroundApiProxy;
    const methodName =
      'serviceAccountSelector.buildActiveAccountInfoFromSelectedAccount';
    const original = proxy.callBackground;
    if (typeof original !== 'function') {
      throw new Error('callBackground is unavailable for the reload probe');
    }
    const probe = {
      completed: 0,
      durationsMs: [],
      failed: 0,
      pending: 0,
      started: 0,
    };
    proxy.callBackground = async function renderBaselineReloadProbe(
      method,
      ...args
    ) {
      if (method !== methodName) {
        return original.call(this, method, ...args);
      }
      probe.pending += 1;
      probe.started += 1;
      const startedAt = globalThis.performance.now();
      try {
        const result = await original.call(this, method, ...args);
        probe.completed += 1;
        return result;
      } catch (error) {
        probe.failed += 1;
        throw error;
      } finally {
        probe.durationsMs.push(
          Math.round((globalThis.performance.now() - startedAt) * 100) / 100,
        );
        probe.pending -= 1;
      }
    };
    globalThis.__renderBaselineReloadProbe = probe;
  });
}

async function readReloadProbe(page) {
  return page.evaluate(() => {
    const probe = globalThis.__renderBaselineReloadProbe;
    if (!probe) {
      throw new Error('Reload probe is not installed');
    }
    return { ...probe };
  });
}

// The decisive phase for reload dedup: emit AccountUpdate with NOTHING changed
// and require the background active-account build to finish before accepting
// the sample. This makes a missing/dropped reload a test failure instead of an
// artificially cheap measurement.
async function flowBackgroundChurn(page) {
  const before = await readReloadProbe(page);
  assert.equal(before.pending, 0, 'Reload probe was busy before churn emit');
  await page.evaluate(() => {
    globalThis.$$appGlobals.$appEventBus.emit('AccountUpdate', undefined);
  });
  // Give the trailing throttle a fixed window to fire and start the reload
  // before the commit-quiescence wait takes over. Together with the settle +
  // quiescence between iterations, consecutive emits are spaced far beyond
  // the 150ms reload throttle.
  await page.waitForTimeout(CHURN_POST_EMIT_WAIT_MS);
  await page.waitForFunction(
    ({ previousStarted }) => {
      const probe = globalThis.__renderBaselineReloadProbe;
      return Boolean(
        probe && probe.started > previousStarted && probe.pending === 0,
      );
    },
    { previousStarted: before.started },
    { timeout: QUIESCENCE_TIMEOUT_MS },
  );
  const after = await readReloadProbe(page);
  const diagnostics = {
    reloadDurationMaxMs: Math.max(
      0,
      ...after.durationsMs.slice(before.durationsMs.length),
    ),
    reloadDurationTotalMs: after.durationsMs
      .slice(before.durationsMs.length)
      .reduce((total, duration) => total + duration, 0),
    reloadsCompleted: after.completed - before.completed,
    reloadsFailed: after.failed - before.failed,
    reloadsStarted: after.started - before.started,
  };
  assert.ok(
    diagnostics.reloadsStarted > 0,
    'AccountUpdate did not start an active-account rebuild',
  );
  assert.equal(
    diagnostics.reloadsCompleted,
    diagnostics.reloadsStarted,
    'Not every active-account rebuild completed',
  );
  assert.equal(diagnostics.reloadsFailed, 0, 'Active-account rebuild failed');
  return diagnostics;
}

// ---------------------------------------------------------------------------
// Measurement driver
// ---------------------------------------------------------------------------

// Conventional median: an even sample count averages the two middle samples
// rather than picking the upper one, so the reported value cannot jump a whole
// sample apart between runs that differ only in ordering. CHURN_EMITS is odd
// for the same reason - the decisive phase's median is then an observed
// sample, not an average of two.
function summarize(values) {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  let median = 0;
  if (sorted.length % 2 === 1) {
    median = sorted[middle];
  } else if (sorted.length) {
    median = (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return {
    max: sorted.length ? sorted[sorted.length - 1] : 0,
    median,
    min: sorted.length ? sorted[0] : 0,
  };
}

function summarizeIterationDiagnostics(iterationDiagnostics) {
  const valuesByMetric = {};
  for (const diagnostics of iterationDiagnostics) {
    for (const [metric, value] of Object.entries(diagnostics)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        valuesByMetric[metric] ||= [];
        valuesByMetric[metric].push(value);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(valuesByMetric)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([metric, values]) => [metric, summarize(values)]),
  );
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

async function measurePhase(
  page,
  phaseName,
  runIteration,
  {
    diagnosticsProbe,
    iterations = ITERATIONS,
    scenario,
    warmupIterations = WARMUP_ITERATIONS,
  } = {},
) {
  log(
    `phase ${phaseName}: ${warmupIterations} warm-up + ${iterations} measured iterations`,
  );
  const commitDeltas = [];
  const renderedComponentDeltas = [];
  const maxRenderedInCommitPerIteration = [];
  const actualDurationMsDeltas = [];
  const longTaskDeltas = [];
  const interactionCountDeltas = [];
  const maxInteractionLatencyMsPerIteration = [];
  const longAnimationFrameCountDeltas = [];
  const maxLongAnimationFrameMsPerIteration = [];
  const wallMs = [];
  const nextPaintCommitDeltas = [];
  const nextPaintRenderedComponentDeltas = [];
  const nextPaintWallMs = [];
  const iterationDiagnostics = [];
  const operationIds = [];
  let missingDurationCommits = 0;
  // The flow-iteration index keeps counting across warm-up and measured
  // iterations, so the alternating flows (account-switch, network-switch)
  // keep alternating seamlessly instead of repeating the warm-up target as a
  // degenerate same-target switch in the first measured iteration. A warm-up
  // failure intentionally fails the phase exactly like a measured-iteration
  // failure: if the flow cannot complete, the environment is broken and any
  // measured numbers would be meaningless.
  // Warm-up: run the same flow and settle the same way, record nothing.
  for (let warmup = 0; warmup < warmupIterations; warmup += 1) {
    await page.waitForTimeout(PHASE_SETTLE_MS);
    await waitForCommitQuiescence(page);
    await runIteration(warmup);
    await waitForNextPaint(page);
    await waitForCommitQuiescence(page);
  }
  for (
    let iteration = warmupIterations;
    iteration < warmupIterations + iterations;
    iteration += 1
  ) {
    await page.waitForTimeout(PHASE_SETTLE_MS);
    await waitForCommitQuiescence(page);
    const resourceBefore = diagnosticsProbe
      ? await diagnosticsProbe()
      : undefined;
    const before = await readCounters(page);
    const operationId = `${phaseName}:${iteration}`;
    operationIds.push(operationId);
    await markOperation(page, operationId, 'start');
    const startedAt = Date.now();
    const flowDiagnostics = await runIteration(iteration);
    await waitForNextPaint(page);
    const nextPaint = await readCounters(page);
    nextPaintCommitDeltas.push(nextPaint.commits - before.commits);
    nextPaintRenderedComponentDeltas.push(
      nextPaint.renderedComponents - before.renderedComponents,
    );
    nextPaintWallMs.push(Date.now() - startedAt);
    await waitForCommitQuiescence(page);
    await markOperation(page, operationId, 'end');
    const after = await readCounters(page);
    commitDeltas.push(after.commits - before.commits);
    renderedComponentDeltas.push(
      after.renderedComponents - before.renderedComponents,
    );
    const commitSlice = await readCommitRenderedSlice(
      page,
      before.commitLogLength,
      after.commitLogLength,
    );
    maxRenderedInCommitPerIteration.push(
      commitSlice.length ? Math.max(...commitSlice) : 0,
    );
    actualDurationMsDeltas.push(
      roundMs(after.actualDurationMs - before.actualDurationMs),
    );
    missingDurationCommits +=
      after.commitsMissingDuration - before.commitsMissingDuration;
    longTaskDeltas.push(after.longTasks - before.longTasks);
    const interactionSlice = await readPerformanceSlice(
      page,
      'interactionDurationsMs',
      before.interactionLogLength,
      after.interactionLogLength,
    );
    interactionCountDeltas.push(interactionSlice.length);
    maxInteractionLatencyMsPerIteration.push(
      interactionSlice.length ? Math.max(...interactionSlice) : 0,
    );
    const longAnimationFrameSlice = await readPerformanceSlice(
      page,
      'longAnimationFrameDurationsMs',
      before.longAnimationFrameLogLength,
      after.longAnimationFrameLogLength,
    );
    longAnimationFrameCountDeltas.push(longAnimationFrameSlice.length);
    maxLongAnimationFrameMsPerIteration.push(
      longAnimationFrameSlice.length ? Math.max(...longAnimationFrameSlice) : 0,
    );
    wallMs.push(Date.now() - startedAt);
    const diagnostics = { ...flowDiagnostics };
    if (diagnosticsProbe && resourceBefore) {
      Object.assign(
        diagnostics,
        diffResourceSnapshots(resourceBefore, await diagnosticsProbe()),
      );
    }
    if (Object.keys(diagnostics).length) {
      iterationDiagnostics.push(diagnostics);
    }
  }
  // actualDuration is best-effort: if any commit in this phase lacked it,
  // report the phase's duration metric as unavailable instead of a partial sum.
  const actualDurationAvailable = missingDurationCommits === 0;
  const result = {
    actualDurationAvailable,
    actualDurationMs: actualDurationAvailable
      ? summarize(actualDurationMsDeltas)
      : 'unavailable',
    actualDurationMsDeltas: actualDurationAvailable
      ? actualDurationMsDeltas
      : 'unavailable',
    commitDeltas,
    commits: summarize(commitDeltas),
    diagnostics: summarizeIterationDiagnostics(iterationDiagnostics),
    iterations,
    iterationDiagnostics,
    interactionCountDeltas,
    interactions: summarize(interactionCountDeltas),
    longTaskDeltas,
    longTasks: summarize(longTaskDeltas),
    longAnimationFrameCountDeltas,
    longAnimationFrames: summarize(longAnimationFrameCountDeltas),
    maxInteractionLatencyMs: summarize(maxInteractionLatencyMsPerIteration),
    maxInteractionLatencyMsPerIteration,
    maxLongAnimationFrameMs: summarize(maxLongAnimationFrameMsPerIteration),
    maxLongAnimationFrameMsPerIteration,
    maxRenderedInCommit: summarize(maxRenderedInCommitPerIteration),
    maxRenderedInCommitPerIteration,
    nextPaintCommitDeltas,
    nextPaintCommits: summarize(nextPaintCommitDeltas),
    nextPaintRenderedComponentDeltas,
    nextPaintRenderedComponents: summarize(nextPaintRenderedComponentDeltas),
    nextPaintWallMs: summarize(nextPaintWallMs),
    operationIds,
    phase: phaseName,
    renderedComponentDeltas,
    renderedComponents: summarize(renderedComponentDeltas),
    scenario,
    wallMs: summarize(wallMs),
    warmupIterations,
  };
  log(
    `phase ${phaseName}: commits/iter median=${result.commits.median} ` +
      `rendered/iter median=${result.renderedComponents.median} ` +
      `maxRendered/commit median=${result.maxRenderedInCommit.median} ` +
      `actualDuration/iter median=${
        actualDurationAvailable ? result.actualDurationMs.median : 'unavailable'
      }`,
  );
  return result;
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const git = gitInfo();
  const devOnlyPassword = getDevOnlyPassword();

  const { child: rendererProcess, rendererUrl } = await startWebRenderer();
  let browser;
  let browserVersion;
  let page;
  const phases = [];
  const notes = [];
  try {
    browser = await launchBrowser();
    browserVersion = browser.version();
    const context = await browser.newContext();
    await context.addInitScript(
      ({ key }) => {
        globalThis.localStorage.setItem(key, 'wallet');
      },
      { key: WALLET_MODE_STORAGE_KEY },
    );
    await context.addInitScript(installRenderBaselineHook);
    page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);

    await page.goto(rendererUrl, {
      timeout: PAGE_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await waitForAppReady(page);

    log('create HD wallet fixture (public BIP39 test mnemonics)');
    const fixture = await createFixture(page, devOnlyPassword);
    assert.equal(fixture.wallets.length, FIXTURE_SCALE.walletCount);
    // createHDWallet auto-selects each new wallet's first account, so the last
    // created wallet is the active one; the measured flows stay on it.
    const primaryWallet = fixture.wallets[fixture.wallets.length - 1];
    assert.equal(
      primaryWallet.accountNames.length,
      FIXTURE_SCALE.accountsPerWallet,
    );

    // Reload so the measured document starts from a clean boot; all measured
    // phases run inside this single document.
    await page.goto(rendererUrl, {
      timeout: PAGE_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await waitForAppReady(page);
    await waitForHomeShell(page);
    await restoreWalletPasswordCache(page, fixture);
    await waitForPersistedSelection(page, { walletId: primaryWallet.walletId });
    await waitForCommitQuiescence(page);
    log(`pin home selection to ${NETWORK_IDS[0]}`);
    await pinHomeToSingleNetwork(page, fixture, NETWORK_IDS[0]);
    const hookInstalled = await page.evaluate(() =>
      Boolean(
        globalThis.__renderBaseline && globalThis.__renderBaseline.commits > 0,
      ),
    );
    assert.equal(
      hookInstalled,
      true,
      'React devtools hook must observe commits (app booted before hook?)',
    );
    await waitForCommitQuiescence(page);
    const bootCounters = await readCounters(page);
    log(
      `boot: ${bootCounters.commits} commits, ` +
        `${bootCounters.renderedComponents} rendered components, ` +
        `${roundMs(bootCounters.actualDurationMs)}ms actualDuration ` +
        `(${bootCounters.commitsMissingDuration} commits without duration), ` +
        `${bootCounters.longTasks} long tasks`,
    );

    phases.push(
      await measurePhase(
        page,
        'account-switch',
        (iteration) => flowAccountSwitch(page, primaryWallet, iteration),
        { scenario: SCENARIO_MATRIX[0] },
      ),
    );
    phases.push(
      await measurePhase(
        page,
        'network-switch',
        (iteration) => flowNetworkSwitch(page, fixture, iteration),
        { scenario: SCENARIO_MATRIX[1] },
      ),
    );
    phases.push(
      await measurePhase(
        page,
        'selector-open-close',
        () => flowSelectorOpenClose(page),
        { scenario: SCENARIO_MATRIX[2] },
      ),
    );
    const retentionProbe = await createResourceSnapshotProbe(context, page);
    try {
      phases.push(
        await measurePhase(
          page,
          'selector-retention',
          () => flowSelectorOpenClose(page),
          {
            diagnosticsProbe: () => retentionProbe.read(),
            iterations: RETENTION_ITERATIONS,
            scenario: SCENARIO_MATRIX[3],
          },
        ),
      );
    } finally {
      await retentionProbe.dispose();
    }
    if (SCENARIO_PROFILE === 'matrix') {
      for (const num of [0, 1]) {
        const scenario = SCENARIO_MATRIX.find(
          (item) => item.sceneName === 'swap' && item.enabledNums[0] === num,
        );
        phases.push(
          await measurePhase(
            page,
            `swap-num-${num}-open-close`,
            () =>
              flowSceneSelectorOpenClose(page, {
                num,
                sceneName: 'swap',
              }),
            { scenario },
          ),
        );
      }

      const dappAccountInfo = await buildMatrixDAppAccountInfo(page, fixture);
      try {
        for (const enabledNumCount of [1, 2, 8]) {
          await configureMatrixDAppConnections(page, dappAccountInfo, [
            enabledNumCount,
          ]);
          const scenario = SCENARIO_MATRIX.find(
            (item) =>
              item.sceneName === 'discover' &&
              item.originCount === 1 &&
              item.enabledNums.length === enabledNumCount,
          );
          phases.push(
            await measurePhase(
              page,
              `discover-${enabledNumCount}-num-open-close`,
              () =>
                flowMatrixDAppConnectionListOpenClose(page, {
                  accountCount: enabledNumCount,
                  originCount: 1,
                }),
              { scenario },
            ),
          );
        }

        await configureMatrixDAppConnections(page, dappAccountInfo, [2, 2]);
        const multiOriginScenario = SCENARIO_MATRIX.find(
          (item) => item.sceneName === 'discover' && item.originCount === 2,
        );
        phases.push(
          await measurePhase(
            page,
            'discover-2-origin-2-num-open-close',
            () =>
              flowMatrixDAppConnectionListOpenClose(page, {
                accountCount: 4,
                originCount: 2,
              }),
            { scenario: multiOriginScenario },
          ),
        );
      } finally {
        await clearMatrixDAppConnections(page);
        await waitForCommitQuiescence(page);
      }
    }
    if (await getSidebarTab(page, 'Trade').count()) {
      phases.push(
        await measurePhase(page, 'tab-switch', () => flowTabSwitch(page), {
          scenario: SCENARIO_MATRIX.find(
            ({ scenario }) => scenario === 'tab-switch',
          ),
        }),
      );
    } else {
      notes.push('tab-switch skipped: Trade sidebar tab not present');
      log('phase tab-switch: skipped (Trade sidebar tab not present)');
    }
    log(
      `pin background-churn state to account ${CHURN_STATE.accountIndex}, ` +
        `network ${CHURN_STATE.networkId}`,
    );
    await selectAccountByIndex(page, primaryWallet, CHURN_STATE.accountIndex);
    await selectNetworkById(page, fixture, CHURN_STATE.networkId);
    await waitForCommitQuiescence(page);
    await installReloadProbe(page);
    phases.push(
      await measurePhase(
        page,
        'background-churn',
        () => flowBackgroundChurn(page),
        {
          iterations: CHURN_EMITS,
          scenario: SCENARIO_MATRIX.find(
            ({ scenario }) => scenario === 'background-churn',
          ),
          warmupIterations: 0,
        },
      ),
    );

    const finalCounters = await readCounters(page);
    const artifact = {
      boot: {
        actualDurationMs: roundMs(bootCounters.actualDurationMs),
        commits: bootCounters.commits,
        commitsMissingDuration: bootCounters.commitsMissingDuration,
        longTasks: bootCounters.longTasks,
        renderedComponents: bootCounters.renderedComponents,
      },
      churnEmits: CHURN_EMITS,
      churnState: CHURN_STATE,
      environment: {
        arch: os.arch(),
        browserVersion,
        headless: shouldRunHeadless(),
        nodeVersion: process.version,
        platform: process.platform,
      },
      fixture: {
        ...FIXTURE_SCALE,
        chainAccountCount:
          FIXTURE_SCALE.walletCount *
          FIXTURE_SCALE.accountsPerWallet *
          NETWORK_IDS.length,
        networkCount: NETWORK_IDS.length,
      },
      git,
      iterations: ITERATIONS,
      metricsVersion: METRICS_VERSION,
      notes,
      operationWindow: OPERATION_WINDOW,
      phases,
      quietMs: QUIET_MS,
      retentionIterations: RETENTION_ITERATIONS,
      scenarioMatrix: SCENARIO_MATRIX,
      scenarioProfile: SCENARIO_PROFILE,
      timestamp: new Date().toISOString(),
      totalActualDurationMs: roundMs(finalCounters.actualDurationMs),
      totalCommits: finalCounters.commits,
      totalCommitsMissingDuration: finalCounters.commitsMissingDuration,
      totalLongTasks: finalCounters.longTasks,
      totalRenderedComponents: finalCounters.renderedComponents,
      walkErrors: finalCounters.walkErrors,
      walkOverflows: finalCounters.walkOverflows,
      warmupIterations: WARMUP_ITERATIONS,
    };
    const sanitizedBranch = git.branch.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const artifactPath = path.join(
      artifactDir,
      `${git.sha}-${sanitizedBranch}-v${METRICS_VERSION}.json`,
    );
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
    log(`artifact: ${artifactPath}`);

    console.table(
      phases.map((phase) => ({
        phase: phase.phase,
        'commits med': phase.commits.median,
        'rendered med': phase.renderedComponents.median,
        'rendered max': phase.renderedComponents.max,
        'max/commit med': phase.maxRenderedInCommit.median,
        'duration med':
          phase.actualDurationAvailable === true
            ? phase.actualDurationMs.median
            : 'n/a',
        'wall ms med': phase.wallMs.median,
      })),
    );

    assert.equal(
      finalCounters.walkErrors,
      0,
      'fiber walk threw: rendered-component counts are unreliable',
    );
    assert.equal(
      finalCounters.walkOverflows,
      0,
      'fiber walk hit its node budget: rendered-component counts undercount',
    );
    // Zero commits per background-churn emit is a legitimate (ideal) churn
    // result, not a broken hook; the interactive phases already prove the hook.
    const hookProvingPhases = phases.filter(
      (phase) => phase.phase !== 'background-churn',
    );
    for (const phase of hookProvingPhases) {
      assert.ok(
        phase.commits.max > 0,
        `phase ${phase.phase} observed zero commits: measurement hook broken`,
      );
      assert.ok(
        phase.renderedComponents.max > 0,
        `phase ${phase.phase} observed zero rendered components: fiber walk broken`,
      );
    }
  } catch (error) {
    if (page) {
      const screenshotPath = path.join(
        artifactDir,
        'render-baseline-failure.png',
      );
      await page
        .screenshot({ fullPage: true, path: screenshotPath })
        .catch(() => {});
      log(`failure screenshot: ${screenshotPath}`);
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await stopProcess(rendererProcess);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildScenarioMatrix,
  diffResourceSnapshots,
  resolveFixtureScale,
  resolveScenarioProfile,
  summarize,
  summarizeIterationDiagnostics,
};
