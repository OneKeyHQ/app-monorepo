#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getDevOnlyPassword,
  launchBrowser,
  startWebRenderer,
  stopProcess,
} = require('./local-secret-envelope.e2e');

const repoRoot = path.resolve(__dirname, '../../..');
const artifactDir =
  process.env.ACCOUNT_SELECTOR_E2E_ARTIFACT_DIR ||
  path.join(repoRoot, '.tmp', 'account-selector-e2e');
const pageTimeoutMs =
  Number(process.env.ACCOUNT_SELECTOR_E2E_TIMEOUT_MS) || 120_000;
const iterations = Number(process.env.ACCOUNT_SELECTOR_E2E_ITERATIONS) || 8;
const configuredCycles = Number(process.env.ACCOUNT_SELECTOR_E2E_CYCLES ?? 1);
const walletModeStorageKey = '$onekey_web_dapp_mode';
const expectedNetworks = ['evm--1', 'evm--137', 'btc--0'];
const simulatedDAppOrigin = 'https://account-selector-e2e.test';
const dappConnectionProviderCommitLimit = readPositiveNumberEnv(
  'ACCOUNT_SELECTOR_E2E_DAPP_CONNECTION_PROVIDER_COMMIT_MAX',
  22,
);

function readPositiveNumberEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallbackValue;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number, received: ${rawValue}`);
  }
  return value;
}

const performanceBudgetDefinitions = [
  {
    defaultLimit: 2000,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_MUTEX_P95_MS',
    event: 'activeReloadResult',
    field: 'mutexWaitMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 5000,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_MUTEX_MAX_MS',
    event: 'activeReloadResult',
    field: 'mutexWaitMs',
    statistic: 'max',
  },
  {
    defaultLimit: 3500,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_TOTAL_P95_MS',
    event: 'activeReloadResult',
    field: 'totalMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 8000,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_TOTAL_MAX_MS',
    event: 'activeReloadResult',
    field: 'totalMs',
    statistic: 'max',
  },
  {
    defaultLimit: 500,
    envName: 'ACCOUNT_SELECTOR_E2E_PROVIDER_COMMIT_P95_MS',
    event: 'providerSubtreeCommit',
    field: 'actualDuration',
    statistic: 'p95',
  },
  {
    defaultLimit: 1500,
    envName: 'ACCOUNT_SELECTOR_E2E_PROVIDER_COMMIT_MAX_MS',
    event: 'providerSubtreeCommit',
    field: 'actualDuration',
    statistic: 'max',
  },
  {
    defaultLimit: 750,
    envName: 'ACCOUNT_SELECTOR_E2E_SELECTION_UPDATE_P95_MS',
    event: 'selectionUpdateResult',
    field: 'totalMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 15_000,
    envName: 'ACCOUNT_SELECTOR_E2E_STORAGE_INIT_MAX_MS',
    event: 'storageInitResult',
    field: 'totalMs',
    statistic: 'max',
  },
].map((budget) => ({
  ...budget,
  limit: readPositiveNumberEnv(budget.envName, budget.defaultLimit),
}));

function log(message) {
  console.log(`[account-selector-e2e] ${message}`);
}

function collectCdpStackFrames(stackTrace, frames = []) {
  let current = stackTrace;
  while (current && frames.length < 40) {
    for (const frame of current.callFrames || []) {
      frames.push({
        columnNumber: frame.columnNumber,
        functionName: frame.functionName,
        lineNumber: frame.lineNumber,
        url: frame.url,
      });
      if (frames.length >= 40) break;
    }
    current = current.parent;
  }
  return frames;
}

function percentile(values, ratio) {
  if (!values.length) return undefined;
  const sorted = [...values].toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function summarizeTimingValues(timingValues) {
  const summary = {};
  for (const [field, values] of Object.entries(timingValues)) {
    if (values.length) {
      summary[field] = {
        count: values.length,
        max: Math.max(...values),
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
      };
    }
  }
  return summary;
}

function recordFanout(fanoutMap, { consumer, id, reason }) {
  if (typeof id !== 'number') return;
  const operation = fanoutMap.get(id) || {
    consumerCommitCounts: new Map(),
    id,
    reason: reason || 'unspecified',
  };
  operation.consumerCommitCounts.set(
    consumer,
    (operation.consumerCommitCounts.get(consumer) || 0) + 1,
  );
  fanoutMap.set(id, operation);
}

function summarizeFanout(fanoutMap) {
  const duplicateConsumers = [];
  const reasonCounts = {};
  let maxCommitsPerConsumer = 0;
  let maxConsumersPerOperation = 0;
  let totalConsumerCommits = 0;
  for (const operation of fanoutMap.values()) {
    reasonCounts[operation.reason] = (reasonCounts[operation.reason] || 0) + 1;
    maxConsumersPerOperation = Math.max(
      maxConsumersPerOperation,
      operation.consumerCommitCounts.size,
    );
    for (const [consumer, commitCount] of operation.consumerCommitCounts) {
      totalConsumerCommits += commitCount;
      maxCommitsPerConsumer = Math.max(maxCommitsPerConsumer, commitCount);
      if (commitCount > 1) {
        duplicateConsumers.push({
          commitCount,
          consumer,
          id: operation.id,
          reason: operation.reason,
        });
      }
    }
  }
  return {
    duplicateConsumers,
    maxCommitsPerConsumer,
    maxConsumersPerOperation,
    operationCount: fanoutMap.size,
    reasonCounts,
    totalConsumerCommits,
  };
}

function buildTraceSummary(events) {
  const eventCounts = {};
  const outcomeCounts = {};
  const timingFields = [
    'actualDuration',
    'bgTotalMs',
    'buildMs',
    'mutexWaitMs',
    'totalMs',
    'workMs',
  ];
  const timings = Object.fromEntries(timingFields.map((field) => [field, []]));
  const timingsByEvent = {};
  const activeReloadFanout = new Map();
  const selectionTransitionFanout = new Map();
  const providerRenders = {
    byDebugName: {},
    commitCount: 0,
    initialSnapshotCommitCount: 0,
    slowCommitCount: 0,
    totalActualDuration: 0,
    trackedCommitCount: 0,
    untrackedCommitCount: 0,
  };

  for (const event of events) {
    eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
    if (typeof event.outcome === 'string') {
      const key = `${event.event}:${event.outcome}`;
      outcomeCounts[key] = (outcomeCounts[key] || 0) + 1;
    }
    for (const field of timingFields) {
      if (typeof event[field] === 'number' && Number.isFinite(event[field])) {
        timings[field].push(event[field]);
        timingsByEvent[event.event] ||= {};
        timingsByEvent[event.event][field] ||= [];
        timingsByEvent[event.event][field].push(event[field]);
      }
    }
    if (
      event.event === 'providerSubtreeCommit' ||
      event.event === 'providerUntrackedCommitBatch'
    ) {
      const isBatch = event.event === 'providerUntrackedCommitBatch';
      const commitCount = isBatch ? event.commitCount : 1;
      const duration = isBatch
        ? event.totalActualDuration
        : event.actualDuration;
      const safeCommitCount = typeof commitCount === 'number' ? commitCount : 0;
      const safeDuration = typeof duration === 'number' ? duration : 0;
      const debugName =
        typeof event.perfDebugName === 'string'
          ? event.perfDebugName
          : `unlabeled:${event.sceneName || 'unknown'}`;
      if (
        event.event === 'providerSubtreeCommit' &&
        event.attribution === 'tracked-account-state'
      ) {
        for (const stateChange of event.stateChanges || []) {
          const consumer = `${debugName}:num-${stateChange.num}`;
          recordFanout(selectionTransitionFanout, {
            consumer,
            id: stateChange.selectionTransitionId,
            reason: stateChange.selectionReason,
          });
          recordFanout(activeReloadFanout, {
            consumer,
            id: stateChange.activeReloadId,
            reason: stateChange.activeTrigger,
          });
        }
      }
      const debugSummary = providerRenders.byDebugName[debugName] || {
        commitCount: 0,
        initialSnapshotCommitCount: 0,
        slowCommitCount: 0,
        totalActualDuration: 0,
        trackedCommitCount: 0,
        untrackedCommitCount: 0,
      };
      debugSummary.commitCount += safeCommitCount;
      debugSummary.totalActualDuration += safeDuration;
      providerRenders.byDebugName[debugName] = debugSummary;
      providerRenders.commitCount += safeCommitCount;
      providerRenders.totalActualDuration += safeDuration;
      if (
        event.attribution === 'initial-provider-snapshot' ||
        event.attribution === 'scope-reset-snapshot'
      ) {
        debugSummary.initialSnapshotCommitCount += safeCommitCount;
        providerRenders.initialSnapshotCommitCount += safeCommitCount;
      } else if (isBatch || event.trackedStateChanged !== true) {
        debugSummary.untrackedCommitCount += safeCommitCount;
        providerRenders.untrackedCommitCount += safeCommitCount;
      } else {
        debugSummary.trackedCommitCount += safeCommitCount;
        providerRenders.trackedCommitCount += safeCommitCount;
      }
      if (event.slow === true) {
        debugSummary.slowCommitCount += 1;
        providerRenders.slowCommitCount += 1;
      }
    }
  }

  const timingSummary = summarizeTimingValues(timings);
  const timingSummaryByEvent = Object.fromEntries(
    Object.entries(timingsByEvent).map(([event, timingValues]) => [
      event,
      summarizeTimingValues(timingValues),
    ]),
  );

  return {
    eventCounts,
    fanout: {
      activeReloads: summarizeFanout(activeReloadFanout),
      selectionTransitions: summarizeFanout(selectionTransitionFanout),
    },
    outcomeCounts,
    providerRenders,
    timingSummary,
    timingSummaryByEvent,
    totalEvents: events.length,
  };
}

function evaluatePerformanceBudgets(summary) {
  return performanceBudgetDefinitions.map((budget) => {
    const observed =
      summary.timingSummaryByEvent[budget.event]?.[budget.field]?.[
        budget.statistic
      ];
    return {
      envName: budget.envName,
      event: budget.event,
      field: budget.field,
      limit: budget.limit,
      observed,
      passed: typeof observed === 'number' && observed <= budget.limit,
      statistic: budget.statistic,
    };
  });
}

function assertPerformanceBudgets(results) {
  const failures = results.filter((result) => !result.passed);
  assert.deepEqual(
    failures.map(({ event, field, limit, observed, statistic }) => ({
      event,
      field,
      limit,
      observed,
      statistic,
    })),
    [],
    'AccountSelector performance budget exceeded',
  );
}

function assertTraceHealth({ droppedCount, events, phase }) {
  assert.equal(droppedCount, 0, `${phase}: trace buffer dropped events`);
  const errorEvents = events.filter((event) => {
    const outcome = typeof event.outcome === 'string' ? event.outcome : '';
    return (
      outcome === 'error' ||
      outcome === 'error-fallback' ||
      outcome === 'partial'
    );
  });
  assert.deepEqual(
    errorEvents.map((event) => ({
      event: event.event,
      outcome: event.outcome,
    })),
    [],
    `${phase}: AccountSelector trace contains error outcomes`,
  );
  const snapshotsWithCausalMetadata = events.filter(
    (event) =>
      event.event === 'providerSubtreeCommit' &&
      (event.attribution === 'initial-provider-snapshot' ||
        event.attribution === 'scope-reset-snapshot') &&
      event.stateChanges?.some(
        (change) =>
          change.selectionTransitionId !== undefined ||
          change.activeReloadId !== undefined,
      ),
  );
  assert.deepEqual(
    snapshotsWithCausalMetadata.map((event) => ({
      event: event.event,
      providerInstanceId: event.providerInstanceId,
    })),
    [],
    `${phase}: provider snapshots must not inherit stale transition metadata`,
  );
}

function assertTraceRequestResultPairs(events) {
  const pairs = [
    ['accountSelectRequested', 'accountSelectResult', 'operationId'],
    ['activeReloadStart', 'activeReloadResult', 'reloadId'],
    ['autoDeriveRequested', 'autoDeriveResult', 'operationId'],
    ['autoDeriveSyncRequested', 'autoDeriveSyncResult', 'operationId'],
    ['autoSelectAccountRequested', 'autoSelectAccountResult', 'operationId'],
    ['availableNetworksRequested', 'availableNetworksResult', 'operationId'],
    ['crossSceneSyncRequested', 'crossSceneSyncResult', 'operationId'],
    ['manualSceneSyncRequested', 'manualSceneSyncResult', 'operationId'],
    ['selectionUpdateRequested', 'selectionUpdateResult', 'attemptId'],
    ['storageInitRequested', 'storageInitResult', 'operationId'],
  ];

  for (const [requestEvent, resultEvent, key] of pairs) {
    const requests = events.filter((event) => event.event === requestEvent);
    const results = events.filter((event) => event.event === resultEvent);
    const requestCounts = new Map();
    const resultCounts = new Map();
    for (const request of requests) {
      requestCounts.set(
        request[key],
        (requestCounts.get(request[key]) || 0) + 1,
      );
    }
    for (const result of results) {
      resultCounts.set(result[key], (resultCounts.get(result[key]) || 0) + 1);
    }
    const unmatched = requests.filter(
      (request) => resultCounts.get(request[key]) !== 1,
    );
    assert.deepEqual(
      unmatched.map((request) => ({ event: requestEvent, id: request[key] })),
      [],
      `${requestEvent}: every request must have exactly one ${resultEvent}`,
    );
    const orphaned = results.filter(
      (result) => requestCounts.get(result[key]) !== 1,
    );
    assert.deepEqual(
      orphaned.map((result) => ({ event: resultEvent, id: result[key] })),
      [],
      `${resultEvent}: every result must have exactly one ${requestEvent}`,
    );
  }
}

function assertStaleReloadPostProcessPairs(events) {
  const staleOutcomes = new Set([
    'stale-after-build',
    'stale-before-build',
    'stale-schedule-before-build',
  ]);
  const staleResults = events.filter(
    (event) =>
      event.event === 'activeReloadResult' &&
      event.scheduleId !== undefined &&
      staleOutcomes.has(event.outcome),
  );
  const postProcessCounts = new Map();
  for (const event of events) {
    if (
      event.event === 'activeReloadPostProcessResult' &&
      event.outcome === 'skip-stale-action'
    ) {
      postProcessCounts.set(
        `${event.scheduleId}:${event.actionOutcome}`,
        (postProcessCounts.get(`${event.scheduleId}:${event.actionOutcome}`) ||
          0) + 1,
      );
    }
  }
  const unmatched = staleResults.filter(
    (event) =>
      postProcessCounts.get(`${event.scheduleId}:${event.outcome}`) !== 1,
  );
  assert.deepEqual(
    unmatched.map((event) => ({
      outcome: event.outcome,
      scheduleId: event.scheduleId,
    })),
    [],
    'Every stale scheduled reload must skip post-processing exactly once',
  );
}

async function waitForAppReady(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
          ?.configureAccountSelectorPerfE2E &&
        globalThis.$$appGlobals?.$$platformEnv,
      ),
    undefined,
    { timeout: pageTimeoutMs },
  );
  const mode = await page.evaluate(() => ({
    isE2E: globalThis.$$appGlobals.$$platformEnv.isE2E,
    isWebDappMode: globalThis.$$appGlobals.$$platformEnv.isWebDappMode,
  }));
  assert.equal(mode.isE2E, true, 'Web renderer must run with E2E_MODE=true');
  assert.equal(
    mode.isWebDappMode,
    false,
    'CDP init script must switch Web to wallet mode before app bootstrap',
  );
}

async function configurePerfTrace(page, devOnlyPassword) {
  const result = await page.evaluate(
    ({ password }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.configureAccountSelectorPerfE2E(
        {
          $$devOnlyPassword: password,
          enabled: true,
        },
      ),
    { password: devOnlyPassword },
  );
  assert.equal(result.enabled, true, 'AccountSelector perf logger is disabled');
}

async function drainPerfTrace(page, devOnlyPassword) {
  return page.evaluate(
    ({ password }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.drainAccountSelectorPerfE2ETrace(
        { $$devOnlyPassword: password },
      ),
    { password: devOnlyPassword },
  );
}

async function collectPerfTraceUntil(
  page,
  devOnlyPassword,
  predicate,
  timeoutMs = pageTimeoutMs,
) {
  const collected = { droppedCount: 0, events: [] };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const next = await drainPerfTrace(page, devOnlyPassword);
    collected.droppedCount += next.droppedCount;
    collected.events.push(...next.events);
    if (predicate(collected.events)) {
      await page.waitForTimeout(350);
      const settled = await drainPerfTrace(page, devOnlyPassword);
      collected.droppedCount += settled.droppedCount;
      collected.events.push(...settled.events);
      return collected;
    }
    await page.waitForTimeout(100);
  }
  return collected;
}

function mergePerfTrace(...traces) {
  return {
    droppedCount: traces.reduce(
      (total, trace) => total + trace.droppedCount,
      0,
    ),
    events: traces.flatMap((trace) => trace.events),
  };
}

async function createFixture(page, devOnlyPassword) {
  return page.evaluate(
    async ({ password }) => {
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
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const indexedAccount = await api.serviceAccount.getIndexedAccountSafe(
            {
              id: indexedAccountId,
            },
          );
          if (indexedAccount) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(
          `Indexed account ${indexedAccountId} was not readable after creation`,
        );
      };

      const createWallet = async (name) => {
        const rawMnemonic = await api.serviceAccount.generateMnemonic(128);
        const encodedMnemonic = await api.servicePassword.encodeSensitiveText({
          text: rawMnemonic,
        });
        const created = await api.serviceAccount.createHDWallet({
          isWalletBackedUp: true,
          mnemonic: encodedMnemonic,
          name,
        });
        const second = await api.serviceAccount.addHDNextIndexedAccount({
          walletId: created.wallet.id,
        });
        const indexedAccountIds = [
          created.indexedAccount.id,
          second.indexedAccountId,
        ];

        for (const indexedAccountId of indexedAccountIds) {
          await waitForIndexedAccount(indexedAccountId);
          await api.serviceAccount.addHDOrHWAccounts({
            deriveType: 'default',
            indexedAccountId,
            networkId: 'evm--1',
            walletId: created.wallet.id,
          });
          await api.serviceAccount.addHDOrHWAccounts({
            createAllDeriveTypes: true,
            deriveType: 'BIP86',
            indexedAccountId,
            networkId: 'btc--0',
            walletId: created.wallet.id,
          });
        }
        return {
          indexedAccountIds,
          walletId: created.wallet.id,
        };
      };

      const wallets = [];
      wallets.push(await createWallet('E2E Wallet Alpha'));
      wallets.push(await createWallet('E2E Wallet Beta'));
      return { wallets };
    },
    { password: devOnlyPassword },
  );
}

async function readPersistedSelection(page, sceneName = 'home', num = 0) {
  return page.evaluate(
    ({ scene, selectionNum }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount(
        {
          num: selectionNum,
          sceneName: scene,
        },
      ),
    { scene: sceneName, selectionNum: num },
  );
}

async function waitForPersistedSelection(
  page,
  expected,
  sceneName = 'home',
  num = 0,
) {
  await page.waitForFunction(
    async ({ expectedSelection, scene, selectionNum }) => {
      const selected =
        await globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount(
          {
            num: selectionNum,
            sceneName: scene,
          },
        );
      if (!selected) return false;
      return Object.entries(expectedSelection).every(
        ([key, value]) => selected[key] === value,
      );
    },
    { expectedSelection: expected, scene: sceneName, selectionNum: num },
    { timeout: pageTimeoutMs },
  );
}

function getDesktopSidebarTab(page, label) {
  return page
    .locator('.sidebar-tab-item')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
}

async function readActiveRouteNames(page) {
  return page.evaluate(() => {
    const routeNames = [];
    let state = globalThis.$$appGlobals.$navigationRef?.current?.getRootState();
    while (state?.routes?.length) {
      const route = state.routes[state.index ?? 0];
      if (!route) break;
      routeNames.push(route.name);
      state = route.state;
    }
    return routeNames;
  });
}

async function switchDesktopSidebarTab(page, label, routeName) {
  const tab = getDesktopSidebarTab(page, label);
  await tab.waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await tab.click({ timeout: pageTimeoutMs });
  await page.waitForTimeout(250);

  let routeNames = await readActiveRouteNames(page);
  if (!routeNames.includes(routeName)) {
    await page.evaluate(async (targetRoute) => {
      const navigation = globalThis.$$appGlobals.$rootAppNavigation;
      if (!navigation?.switchTabAsync) {
        throw new Error('Root switchTabAsync navigation is unavailable');
      }
      await navigation.switchTabAsync(targetRoute);
    }, routeName);
    await page.waitForFunction(
      (targetRoute) => {
        let state =
          globalThis.$$appGlobals.$navigationRef?.current?.getRootState();
        while (state?.routes?.length) {
          const route = state.routes[state.index ?? 0];
          if (!route) break;
          if (route.name === targetRoute) return true;
          state = route.state;
        }
        return false;
      },
      routeName,
      { timeout: pageTimeoutMs },
    );
    routeNames = await readActiveRouteNames(page);
  }
  assert.ok(
    routeNames.includes(routeName),
    `Expected active route ${routeName}, received ${routeNames.join(' > ')}`,
  );
}

async function waitForHomeShell(page) {
  const onboardingClose = page.locator(
    '[data-testid="page-close-trigger"]:visible, ' +
      '[data-testid="onboardingv2-handle-back-icon-btn"]:visible, ' +
      '[data-testid="onboarding-layout-header-back-btn"]:visible, ' +
      '[data-testid="onboarding-icon-btn"]:visible',
  );
  const homeTab = getDesktopSidebarTab(page, 'Wallet');
  const accountTrigger = page
    .locator('[data-testid="AccountSelectorTriggerBase"]:visible')
    .first();
  const deadline = Date.now() + pageTimeoutMs;
  let homeStableSince;

  while (Date.now() < deadline) {
    if (await onboardingClose.count()) {
      homeStableSince = undefined;
      await onboardingClose
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
    } else {
      if (await accountTrigger.count()) {
        homeStableSince ??= Date.now();
        if (Date.now() - homeStableSince >= 2000) {
          return;
        }
      } else {
        homeStableSince = undefined;
      }
      if (await homeTab.count()) {
        await switchDesktopSidebarTab(page, 'Wallet', 'Home').catch(() => {});
      }
    }
    await page.waitForTimeout(250);
  }
  await accountTrigger.waitFor({ state: 'visible', timeout: 1 });
}

async function openAccountSelector(page) {
  await page
    .locator('[data-testid="AccountSelectorTriggerBase"]:visible')
    .first()
    .click({ timeout: pageTimeoutMs });
  await page
    .locator('[data-testid="account-selector-wallet-list"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
}

async function selectWalletAccount(
  page,
  { indexedAccountId, index, walletId },
  { waitForCommit = true } = {},
) {
  await openAccountSelector(page);
  await page
    .locator(`[data-testid="wallet-${walletId}"]:visible`)
    .first()
    .click({ timeout: pageTimeoutMs });
  await page
    .locator(`[data-testid="account-item-index-${index}"]:visible`)
    .first()
    .click({ timeout: pageTimeoutMs });
  if (!waitForCommit) {
    await page
      .locator('[data-testid="account-selector-wallet-list"]:visible')
      .first()
      .waitFor({ state: 'hidden', timeout: pageTimeoutMs });
    return;
  }
  await waitForPersistedSelection(page, { indexedAccountId, walletId });
  await page
    .locator('[data-testid="account-name"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
}

async function selectNetwork(page, networkId, { waitForCommit = true } = {}) {
  const trigger = page.locator(
    '[data-testid="account-network-trigger-button"]:visible, ' +
      '[data-testid="account-all-networks-trigger-button"]:visible',
  );
  await trigger.first().click({ timeout: pageTimeoutMs });

  const networkTab = page.locator(
    '[data-testid="unified-network-selector-network-tab"]:visible',
  );
  await networkTab
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await networkTab.first().click({ timeout: pageTimeoutMs });

  const networkItem = page.locator(
    `[data-testid="${networkId}"]:visible, ` +
      `[data-testid="select-item-${networkId}"]:visible`,
  );
  await networkItem.first().click({ timeout: pageTimeoutMs });
  if (waitForCommit) {
    await waitForPersistedSelection(page, { networkId });
  } else {
    await networkItem
      .first()
      .waitFor({ state: 'hidden', timeout: pageTimeoutMs });
  }
}

async function selectDifferentBtcDeriveType(page) {
  const previous = await readPersistedSelection(page);
  const selectedDeriveType = await page.evaluate(
    async ({ previousDeriveType }) => {
      const serviceNetwork =
        globalThis.$$appGlobals.$backgroundApiProxy.serviceNetwork;
      const items = await serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId: 'btc--0',
      });
      const next = items.find((item) => item.value !== previousDeriveType);
      if (!next) return undefined;
      await serviceNetwork.saveGlobalDeriveTypeForNetwork({
        deriveType: next.value,
        networkId: 'btc--0',
      });
      return next.value;
    },
    { previousDeriveType: previous?.deriveType },
  );
  assert.ok(
    selectedDeriveType,
    'BTC derive service must expose an alternative derive type',
  );
  await waitForPersistedSelection(page, { deriveType: selectedDeriveType });
}

async function runRapidSelectionBursts(page, fixture) {
  const accountTargets = [
    {
      index: 0,
      indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
      walletId: fixture.wallets[0].walletId,
    },
    {
      index: 1,
      indexedAccountId: fixture.wallets[1].indexedAccountIds[1],
      walletId: fixture.wallets[1].walletId,
    },
    {
      index: 1,
      indexedAccountId: fixture.wallets[0].indexedAccountIds[1],
      walletId: fixture.wallets[0].walletId,
    },
  ];
  for (const target of accountTargets) {
    await selectWalletAccount(page, target, { waitForCommit: false });
  }
  const finalAccount = accountTargets[accountTargets.length - 1];
  await waitForPersistedSelection(page, {
    indexedAccountId: finalAccount.indexedAccountId,
    walletId: finalAccount.walletId,
  });

  const networkTargets = ['evm--1', 'btc--0', 'evm--137'];
  for (const networkId of networkTargets) {
    await selectNetwork(page, networkId, { waitForCommit: false });
  }
  await waitForPersistedSelection(page, {
    networkId: networkTargets[networkTargets.length - 1],
  });

  await selectNetwork(page, 'btc--0');
  const deriveBurst = await page.evaluate(async () => {
    const api = globalThis.$$appGlobals.$backgroundApiProxy;
    const selected = await api.simpleDb.accountSelector.getSelectedAccount({
      num: 0,
      sceneName: 'home',
    });
    const deriveItems = await api.serviceNetwork.getDeriveInfoItemsOfNetwork({
      networkId: 'btc--0',
    });
    const alternatives = deriveItems
      .map((item) => item.value)
      .filter((value) => value !== selected?.deriveType);
    const finalDeriveType = alternatives[0];
    if (!finalDeriveType) {
      return undefined;
    }
    const writes = [
      finalDeriveType,
      selected?.deriveType,
      alternatives[1] || finalDeriveType,
      finalDeriveType,
    ].filter(Boolean);
    for (const deriveType of writes) {
      await api.serviceNetwork.saveGlobalDeriveTypeForNetwork({
        deriveType,
        networkId: 'btc--0',
      });
    }
    return { finalDeriveType, writes: writes.length };
  });
  assert.ok(deriveBurst?.writes >= 3, 'BTC derive burst needs three writes');
  await waitForPersistedSelection(page, {
    deriveType: deriveBurst.finalDeriveType,
    networkId: 'btc--0',
  });
}

async function assertSwapConsumer(page, expectedSelection) {
  const swapTab = getDesktopSidebarTab(page, 'Trade');
  if (!(await swapTab.count())) return;
  await switchDesktopSidebarTab(page, 'Trade', 'Swap');
  await page
    .locator('[data-testid="swap-content-container"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await page
    .locator('[data-testid="swap-from-amount-input"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await page
    .locator('[data-testid="swap-to-amount-input"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await waitForPersistedSelection(page, expectedSelection, 'swap');
  await switchDesktopSidebarTab(page, 'Wallet', 'Home');
}

async function addSimulatedCustomNetwork(page, cycle) {
  return page.evaluate(
    async ({ cycleNumber }) => {
      const serviceCustomRpc =
        globalThis.$$appGlobals.$$backgroundApi?.serviceCustomRpc;
      if (!serviceCustomRpc?.upsertCustomNetworkInfo) {
        throw new Error(
          'Direct ServiceCustomRpc is unavailable in the Web single runtime',
        );
      }
      const chainId = String(31_337 + cycleNumber);
      const networkId = `evm--${chainId}`;
      const networkName = `E2E Custom ${chainId}`;
      await serviceCustomRpc.upsertCustomNetworkInfo({
        networkInfo: {
          backendIndex: false,
          chainId,
          code: networkName,
          decimals: 18,
          defaultEnabled: true,
          explorerURL: 'https://account-selector-e2e.test/explorer',
          feeMeta: {
            decimals: 9,
            isEIP1559FeeEnabled: true,
            isWithL1BaseFee: false,
            symbol: 'Gwei',
          },
          id: networkId,
          impl: 'evm',
          isCustomNetwork: true,
          isTestnet: true,
          logoURI: '',
          name: networkName,
          shortcode: networkName,
          shortname: networkName,
          status: 'LISTED',
          symbol: 'E2E',
        },
        rpcUrl: 'http://127.0.0.1:8545',
        skipSaveLocalSyncItem: true,
      });
      return { networkId };
    },
    { cycleNumber: cycle },
  );
}

async function runMultiNumAndCustomNetworkScenario(
  page,
  devOnlyPassword,
  cycle,
) {
  const homeSelection = await readPersistedSelection(page);
  assert.ok(homeSelection?.walletId, 'Home selection must have a wallet');
  assert.ok(
    homeSelection?.indexedAccountId,
    'Home selection must have an indexed account',
  );

  await switchDesktopSidebarTab(page, 'Trade', 'Swap');
  await page
    .locator('[data-testid="swap-content-container"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await waitForPersistedSelection(
    page,
    {
      indexedAccountId: homeSelection.indexedAccountId,
      walletId: homeSelection.walletId,
    },
    'swap',
    0,
  );
  await waitForPersistedSelection(
    page,
    {
      indexedAccountId: homeSelection.indexedAccountId,
      walletId: homeSelection.walletId,
    },
    'swap',
    1,
  );

  const mountTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      [0, 1].every((num) =>
        events.some(
          (event) =>
            event.event === 'effectsStateObserved' &&
            event.sceneName === 'swap' &&
            event.num === num &&
            event.selection?.hasWallet === true &&
            event.activeAccount?.ready === true,
        ),
      ),
  );

  const { networkId } = await addSimulatedCustomNetwork(page, cycle);
  await page.waitForFunction(
    async ({ expectedNetworkId }) => {
      const result =
        await globalThis.$$appGlobals.$backgroundApiProxy.serviceNetwork.getAllNetworkIds();
      return result.networkIds.includes(expectedNetworkId);
    },
    { expectedNetworkId: networkId },
    { timeout: pageTimeoutMs },
  );
  const customNetworkTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      [0, 1].every(
        (num) =>
          events.some(
            (event) =>
              event.event === 'availableNetworksResult' &&
              event.consumer === 'auto-select-network' &&
              event.num === num &&
              event.outcome === 'success' &&
              event.sceneName === 'swap' &&
              event.trigger === 'custom-network-event',
          ) &&
          events.some(
            (event) =>
              event.event === 'activeReloadResult' &&
              event.num === num &&
              event.sceneName === 'swap' &&
              event.trigger === 'custom-network-update',
          ),
      ),
  );
  const trace = mergePerfTrace(mountTrace, customNetworkTrace);
  assertTraceHealth({ ...trace, phase: 'multi-num-custom-network' });

  for (const num of [0, 1]) {
    const requests = customNetworkTrace.events.filter(
      (event) =>
        event.event === 'availableNetworksRequested' &&
        event.consumer === 'auto-select-network' &&
        event.num === num &&
        event.sceneName === 'swap' &&
        event.trigger === 'custom-network-event',
    );
    const schedules = customNetworkTrace.events.filter(
      (event) =>
        event.event === 'activeReloadScheduled' &&
        event.num === num &&
        event.sceneName === 'swap' &&
        event.trigger === 'custom-network-update',
    );
    assert.equal(
      requests.length,
      1,
      `Swap num ${num} must refresh available networks exactly once`,
    );
    assert.equal(
      schedules.length,
      1,
      `Swap num ${num} must schedule one custom-network reload`,
    );
  }
  assert.ok(
    customNetworkTrace.events.some(
      (event) =>
        event.event === 'availableNetworksResult' &&
        event.changed === true &&
        event.trigger === 'custom-network-event',
    ),
    'Custom network refresh must observe the changed network list',
  );

  await switchDesktopSidebarTab(page, 'Wallet', 'Home');
  await waitForHomeShell(page);
  return { networkId, trace };
}

async function openAndApproveSimulatedDAppConnection(page, devOnlyPassword) {
  await page.evaluate(
    ({ origin }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.deleteConnection(
        origin,
        'injectedProvider',
      ),
    { origin: simulatedDAppOrigin },
  );
  await drainPerfTrace(page, devOnlyPassword);
  await page.evaluate(
    ({ origin }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const state = {
        hasResult: false,
        outcome: 'pending',
      };
      globalThis.__accountSelectorE2EDappConnection = state;
      void api.serviceDApp
        .openConnectionModal({
          data: {
            method: 'eth_requestAccounts',
            params: [],
          },
          id: `account-selector-e2e-${Date.now()}`,
          origin,
          scope: 'ethereum',
        })
        .then((result) => {
          state.hasResult = Boolean(result);
          state.outcome = 'resolved';
        })
        .catch((error) => {
          state.error = error?.message || String(error);
          state.outcome = 'rejected';
        });
    },
    { origin: simulatedDAppOrigin },
  );

  const modal = page
    .locator('[data-testid="dapp-connection-modal"]:visible')
    .first();
  await modal.waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await page
    .locator('[data-testid="dapp-connection-account-list-item"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });

  const initializationTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      events.some(
        (event) =>
          event.event === 'autoSelectAccountResult' &&
          event.num === 0 &&
          event.sceneName === 'discover' &&
          event.source === 'active-ready',
      ) &&
      events.some(
        (event) =>
          event.event === 'manualSceneSyncResult' &&
          event.num === 0 &&
          event.sourceNum === 0 &&
          event.sourceSceneName === 'home',
      ) &&
      events.some(
        (event) =>
          event.event === 'dappConnectionAccountObserved' &&
          event.num === 0 &&
          event.hasAddress === true,
      ) &&
      events.some(
        (event) =>
          event.event === 'providerSubtreeCommit' &&
          event.perfDebugName === 'dapp-connection-modal',
      ),
  );
  assertTraceHealth({
    ...initializationTrace,
    phase: 'dapp-connection-modal-initialization',
  });
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactDir, 'dapp-connection-initialization-trace.json'),
    `${JSON.stringify(initializationTrace, null, 2)}\n`,
  );

  const autoSelectRequests = initializationTrace.events.filter(
    (event) =>
      event.event === 'autoSelectAccountRequested' &&
      event.num === 0 &&
      event.sceneName === 'discover' &&
      event.source === 'active-ready',
  );
  assert.equal(
    autoSelectRequests.length,
    1,
    'DApp connection modal must start auto-select exactly once',
  );
  const sceneSyncRequests = initializationTrace.events.filter(
    (event) =>
      event.event === 'manualSceneSyncRequested' &&
      event.num === 0 &&
      event.sourceNum === 0 &&
      event.sourceSceneName === 'home',
  );
  assert.equal(
    sceneSyncRequests.length,
    1,
    'DApp connection modal must sync Home selection exactly once',
  );
  const effectInstanceIds = new Set(
    initializationTrace.events
      .filter(
        (event) =>
          event.event === 'effectsStateObserved' &&
          event.num === 0 &&
          event.sceneName === 'discover',
      )
      .map((event) => event.effectInstanceId),
  );
  assert.equal(
    effectInstanceIds.size,
    1,
    'DApp connection modal must mount one AccountSelectorEffects instance',
  );
  const appliedAccountObservations = initializationTrace.events.filter(
    (event) =>
      event.event === 'dappConnectionAccountObserved' &&
      event.num === 0 &&
      event.appliedToModal === true,
  );
  assert.equal(
    appliedAccountObservations.length,
    1,
    'DApp connection modal must apply one usable account observation',
  );
  const accountObservations = initializationTrace.events.filter(
    (event) =>
      event.event === 'dappConnectionAccountObserved' && event.num === 0,
  );
  assert.ok(
    accountObservations.length <= 2,
    `DApp connection modal observed ${accountObservations.length} account states (limit 2)`,
  );
  const initializationSelectionUpdates = initializationTrace.events.filter(
    (event) =>
      event.event === 'selectionStateUpdated' &&
      event.num === 0 &&
      ['syncFromScene', 'autoSelectNetwork', 'autoDeriveFallback'].includes(
        event.reason,
      ),
  );
  assert.equal(
    initializationSelectionUpdates.length,
    1,
    `DApp connection initialization must update selection once, received ${initializationSelectionUpdates.length}`,
  );
  assert.equal(
    initializationSelectionUpdates[0]?.reason,
    'syncFromScene',
    'DApp connection initialization must atomically prepare the Home selection',
  );
  for (const field of [
    'walletId',
    'indexedAccountId',
    'networkId',
    'deriveType',
    'focusedWallet',
  ]) {
    assert.ok(
      initializationSelectionUpdates[0]?.changedFields?.includes(field),
      `DApp connection atomic selection update must include ${field}`,
    );
  }
  const initializationActiveReloads = initializationTrace.events.filter(
    (event) =>
      event.event === 'activeReloadResult' &&
      event.num === 0 &&
      event.sceneName === 'discover' &&
      event.outcome === 'commit' &&
      ['syncFromScene', 'autoSelectNetwork', 'autoDeriveFallback'].includes(
        event.reason,
      ),
  );
  assert.equal(
    initializationActiveReloads.length,
    1,
    `DApp connection initialization must reload the active account once, received ${initializationActiveReloads.length}`,
  );
  assert.equal(
    initializationActiveReloads[0]?.reason,
    'syncFromScene',
    'DApp connection initialization reload must use the atomic scene sync',
  );

  const approveButton = page
    .locator('[data-testid="dapp-connection-approve-btn"]:visible')
    .first();
  await approveButton.click({ timeout: pageTimeoutMs });
  await modal.waitFor({ state: 'hidden', timeout: pageTimeoutMs });
  await page.waitForFunction(
    () => globalThis.__accountSelectorE2EDappConnection?.outcome !== 'pending',
    undefined,
    { timeout: pageTimeoutMs },
  );
  const connectionResult = await page.evaluate(
    () => globalThis.__accountSelectorE2EDappConnection,
  );
  assert.deepEqual(
    {
      error: connectionResult?.error,
      hasResult: connectionResult?.hasResult,
      outcome: connectionResult?.outcome,
    },
    { error: undefined, hasResult: true, outcome: 'resolved' },
    'Simulated DApp connection request must resolve through the real modal',
  );
  await page.waitForTimeout(350);
  const completionTrace = await drainPerfTrace(page, devOnlyPassword);
  const trace = mergePerfTrace(initializationTrace, completionTrace);
  const dappConnectionSummary = buildTraceSummary(trace.events);
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactDir, 'dapp-connection-trace.json'),
    JSON.stringify(
      {
        events: trace.events,
        summary: dappConnectionSummary,
      },
      null,
      2,
    ),
  );
  const providerSummary =
    dappConnectionSummary.providerRenders.byDebugName['dapp-connection-modal'];
  assert.ok(providerSummary, 'DApp connection Provider trace is missing');
  assert.ok(
    providerSummary.commitCount <= dappConnectionProviderCommitLimit,
    `DApp connection Provider committed ${providerSummary.commitCount} times (limit ${dappConnectionProviderCommitLimit})`,
  );

  const dappMap = await page.evaluate(
    ({ origin }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
        { sceneUrl: origin },
      ),
    { origin: simulatedDAppOrigin },
  );
  assert.ok(dappMap?.[0]?.walletId, 'DApp approval must persist a wallet');
  assert.ok(
    dappMap?.[0]?.indexedAccountId || dappMap?.[0]?.othersWalletAccountId,
    'DApp approval must persist an account',
  );
  assert.equal(
    dappMap?.[0]?.networkId,
    'evm--1',
    'DApp approval must inherit the Home EVM network',
  );
  return trace;
}

async function openSimulatedDAppAccountSelector(page) {
  await page.waitForFunction(
    () => Boolean(globalThis.$$appGlobals.$rootAppNavigation?.pushModal),
    undefined,
    { timeout: pageTimeoutMs },
  );
  await page.evaluate(
    ({ origin }) => {
      globalThis.$$appGlobals.$rootAppNavigation.pushModal(
        'AccountManagerStacks',
        {
          params: {
            num: 0,
            sceneName: 'discover',
            sceneUrl: origin,
          },
          screen: 'AccountSelectorStack',
        },
      );
    },
    { origin: simulatedDAppOrigin },
  );
  await page
    .locator('[data-testid="account-selector-wallet-list"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
}

async function closeSimulatedDAppAccountSelector(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await page
    .locator('[data-testid="account-selector-wallet-list"]:visible')
    .first()
    .waitFor({ state: 'hidden', timeout: pageTimeoutMs })
    .catch(() => undefined);
  await waitForHomeShell(page);
}

async function runSimulatedDAppScenario(page, devOnlyPassword) {
  const connectionTrace = await openAndApproveSimulatedDAppConnection(
    page,
    devOnlyPassword,
  );
  await drainPerfTrace(page, devOnlyPassword);
  await openSimulatedDAppAccountSelector(page);

  const initializationTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      events.some(
        (event) =>
          event.event === 'storageInitResult' &&
          event.sceneName === 'discover' &&
          event.outcome !== 'error-finalized',
      ) &&
      events.some(
        (event) =>
          event.event === 'effectsStateObserved' &&
          event.num === 0 &&
          event.sceneName === 'discover' &&
          event.selection?.networkId === 'evm--1' &&
          event.selection?.hasWallet === true,
      ),
  );
  assertTraceHealth({ ...initializationTrace, phase: 'dapp-initialization' });

  await page.evaluate(
    ({ origin }) => {
      const eventBus = globalThis.$$appGlobals.$appEventBus;
      eventBus.emit('DAppNetworkUpdate', {
        networkId: 'evm--137',
        num: 0,
        sceneName: 'discover',
        sceneUrl: `${origin}.wrong`,
      });
      eventBus.emit('DAppNetworkUpdate', {
        networkId: 'evm--137',
        num: 1,
        sceneName: 'discover',
        sceneUrl: origin,
      });
    },
    { origin: simulatedDAppOrigin },
  );
  await page.waitForTimeout(500);
  const ignoredEventTrace = await drainPerfTrace(page, devOnlyPassword);
  assert.deepEqual(
    ignoredEventTrace.events.filter(
      (event) =>
        event.event === 'selectionUpdateRequested' &&
        event.reason === 'dappNetworkEvent',
    ),
    [],
    'Mismatched DApp sceneUrl/num events must not update selection',
  );

  await page.evaluate(
    async ({ origin }) => {
      await globalThis.$$appGlobals.$backgroundApiProxy.serviceDApp.switchConnectedNetwork(
        {
          newNetworkId: 'evm--137',
          oldNetworkId: 'evm--1',
          origin,
          scope: 'ethereum',
        },
      );
    },
    { origin: simulatedDAppOrigin },
  );
  const updateTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      events.some(
        (event) =>
          event.event === 'selectionUpdateResult' &&
          event.reason === 'dappNetworkEvent',
      ) &&
      events.some(
        (event) =>
          event.event === 'effectsStateObserved' &&
          event.num === 0 &&
          event.sceneName === 'discover' &&
          event.selection?.networkId === 'evm--137',
      ) &&
      events.some(
        (event) =>
          event.event === 'activeReloadResult' &&
          event.num === 0 &&
          event.sceneName === 'discover',
      ),
  );
  const dappMap = await page.evaluate(
    ({ origin }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
        { sceneUrl: origin },
      ),
    { origin: simulatedDAppOrigin },
  );
  assert.equal(
    dappMap?.[0]?.networkId,
    'evm--137',
    'Simulated DApp connection must persist the switched network',
  );
  const dappRequests = updateTrace.events.filter(
    (event) =>
      event.event === 'selectionUpdateRequested' &&
      event.reason === 'dappNetworkEvent',
  );
  assert.equal(
    dappRequests.length,
    1,
    'A DApp network update must enter selection update exactly once',
  );

  const trace = mergePerfTrace(
    connectionTrace,
    initializationTrace,
    ignoredEventTrace,
    updateTrace,
  );
  assertTraceHealth({ ...trace, phase: 'simulated-dapp' });
  await closeSimulatedDAppAccountSelector(page);
  await page.evaluate(
    ({ origin }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.deleteConnection(
        origin,
        'injectedProvider',
      ),
    { origin: simulatedDAppOrigin },
  );
  return trace;
}

async function removeSelectedAccountAndWaitForFallback(page, fixture) {
  const selectedTarget = {
    index: 1,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[1],
    walletId: fixture.wallets[0].walletId,
  };
  log('auto-select: select account scheduled for removal');
  await selectWalletAccount(page, selectedTarget);
  log('auto-select: remove selected indexed account');
  await page.evaluate(
    async ({ indexedAccountId }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const indexedAccount = await api.serviceAccount.getIndexedAccountSafe({
        id: indexedAccountId,
      });
      await api.serviceAccount.removeAccount({ indexedAccount });
    },
    { indexedAccountId: selectedTarget.indexedAccountId },
  );
  log('auto-select: wait for account fallback');
  await page.waitForFunction(
    async ({ removedId }) => {
      const selected =
        await globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount(
          { num: 0, sceneName: 'home' },
        );
      return Boolean(
        selected?.indexedAccountId && selected.indexedAccountId !== removedId,
      );
    },
    { removedId: selectedTarget.indexedAccountId },
    { timeout: pageTimeoutMs },
  );
  log('auto-select: account fallback completed');
}

async function removeSelectedWalletAndWaitForFallback(
  page,
  fixture,
  devOnlyPassword,
) {
  const removedWallet = fixture.wallets[1];
  log('auto-select: select wallet scheduled for removal');
  await selectWalletAccount(page, {
    index: 0,
    indexedAccountId: removedWallet.indexedAccountIds[0],
    walletId: removedWallet.walletId,
  });
  log('auto-select: remove isolated E2E wallet');
  await page.evaluate(
    ({ password, walletId }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.removeAccountSelectorE2EWallet(
        {
          $$devOnlyPassword: password,
          walletId,
        },
      ),
    { password: devOnlyPassword, walletId: removedWallet.walletId },
  );
  log('auto-select: wait for wallet fallback');
  await waitForPersistedSelection(page, {
    walletId: fixture.wallets[0].walletId,
  });
  log('auto-select: wallet fallback completed');
}

async function runStressInteractions(page, fixture) {
  const targets = [
    {
      index: 0,
      indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
      walletId: fixture.wallets[0].walletId,
    },
    {
      index: 1,
      indexedAccountId: fixture.wallets[1].indexedAccountIds[1],
      walletId: fixture.wallets[1].walletId,
    },
    {
      index: 1,
      indexedAccountId: fixture.wallets[0].indexedAccountIds[1],
      walletId: fixture.wallets[0].walletId,
    },
    {
      index: 0,
      indexedAccountId: fixture.wallets[1].indexedAccountIds[0],
      walletId: fixture.wallets[1].walletId,
    },
  ];

  for (let index = 0; index < iterations; index += 1) {
    const target = targets[index % targets.length];
    await selectWalletAccount(page, target);
    const networkId = expectedNetworks[index % expectedNetworks.length];
    await selectNetwork(page, networkId);
    if (networkId === 'btc--0') {
      await selectDifferentBtcDeriveType(page);
    }
    if (index % 3 === 2) {
      await assertSwapConsumer(page, {
        indexedAccountId: target.indexedAccountId,
        walletId: target.walletId,
      });
    }
  }
}

async function closeResidualE2EBrowserContexts(browser, phase) {
  const contexts = browser.contexts();
  const tabCount = contexts.reduce(
    (count, context) => count + context.pages().length,
    0,
  );
  if (contexts.length || tabCount) {
    log(
      `${phase}: close ${tabCount} residual tab(s) in ${contexts.length} E2E context(s)`,
    );
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
  assert.equal(
    browser.contexts().length,
    0,
    `${phase}: residual E2E browser contexts must be empty`,
  );
  log(`${phase}: verified 0 residual E2E tabs`);
}

async function runCycle({ browser, cycle, rendererUrl }) {
  const devOnlyPassword = getDevOnlyPassword();
  await closeResidualE2EBrowserContexts(browser, `cycle#${cycle} preflight`);
  const context = await browser.newContext();
  assert.equal(
    context.pages().length,
    0,
    `cycle#${cycle}: a new E2E context must start without tabs`,
  );
  await context.addInitScript(
    ({ key }) => {
      globalThis.localStorage.setItem(key, 'wallet');
    },
    { key: walletModeStorageKey },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(pageTimeoutMs);

  const pageErrors = [];
  const cdpExceptions = [];
  page.on('pageerror', (error) =>
    pageErrors.push({
      message: error.message,
      name: error.name,
      stack: error.stack,
    }),
  );
  const cdp = await context.newCDPSession(page);
  await Promise.all([cdp.send('Runtime.enable'), cdp.send('Debugger.enable')]);
  await cdp.send('Debugger.setAsyncCallStackDepth', { maxDepth: 32 });
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    cdpExceptions.push({
      description: exceptionDetails.exception?.description,
      exceptionId: exceptionDetails.exceptionId,
      frames: collectCdpStackFrames(exceptionDetails.stackTrace),
      lineNumber: exceptionDetails.lineNumber,
      text: exceptionDetails.text,
      url: exceptionDetails.url,
    });
  });

  try {
    await page.goto(rendererUrl, {
      timeout: pageTimeoutMs,
      waitUntil: 'domcontentloaded',
    });
    await waitForAppReady(page);
    await configurePerfTrace(page, devOnlyPassword);
    await drainPerfTrace(page, devOnlyPassword);

    log(`cycle#${cycle}: create isolated HD wallet fixture`);
    const fixture = await createFixture(page, devOnlyPassword);
    await waitForPersistedSelection(page, {
      walletId: fixture.wallets[0].walletId,
    });
    await page.waitForTimeout(500);

    log(`cycle#${cycle}: reload and verify atom/storage initialization`);
    await page.goto(rendererUrl, {
      timeout: pageTimeoutMs,
      waitUntil: 'domcontentloaded',
    });
    await waitForAppReady(page);
    await waitForHomeShell(page);
    const initTrace = await collectPerfTraceUntil(
      page,
      devOnlyPassword,
      (events) => events.some((event) => event.event === 'storageInitResult'),
    );
    assertTraceHealth({ ...initTrace, phase: 'initialization' });
    assert.ok(
      initTrace.events.some((event) => event.event === 'storageInitResult'),
      'Initialization trace must contain storageInitResult',
    );

    log(`cycle#${cycle}: verify Swap multi-num and custom-network refresh`);
    const multiNumResult = await runMultiNumAndCustomNetworkScenario(
      page,
      devOnlyPassword,
      cycle,
    );
    log(
      `cycle#${cycle}: verify simulated DApp connection modal and Discover network update`,
    );
    const dappTrace = await runSimulatedDAppScenario(page, devOnlyPassword);

    log(
      `cycle#${cycle}: run ${iterations} wallet/account/network/derive iterations`,
    );
    await runStressInteractions(page, fixture);
    log(`cycle#${cycle}: run latest-wins account/network/derive bursts`);
    await runRapidSelectionBursts(page, fixture);
    await page.waitForTimeout(1000);
    const stressTrace = await drainPerfTrace(page, devOnlyPassword);
    assertTraceHealth({ ...stressTrace, phase: 'stress' });
    assert.ok(
      stressTrace.events.some(
        (event) => event.event === 'activeReloadCoalesced',
      ),
      'Rapid selection must coalesce active reloads',
    );
    assert.ok(
      stressTrace.events.some(
        (event) => event.event === 'globalDeriveEventCoalesced',
      ),
      'Rapid derive writes must coalesce global derive events',
    );

    log(`cycle#${cycle}: verify account and wallet removal auto-selection`);
    await removeSelectedAccountAndWaitForFallback(page, fixture);
    await removeSelectedWalletAndWaitForFallback(
      page,
      fixture,
      devOnlyPassword,
    );
    await page.waitForTimeout(3000);
    const autoSelectTrace = await drainPerfTrace(page, devOnlyPassword);
    assertTraceHealth({ ...autoSelectTrace, phase: 'auto-select' });
    assert.ok(
      autoSelectTrace.events.some(
        (event) => event.event === 'autoSelectAccountResult',
      ),
      'Removal flow must produce autoSelectAccountResult',
    );
    assert.ok(
      autoSelectTrace.events.some(
        (event) =>
          event.event === 'autoSelectAccountResult' &&
          event.source === 'wallet-update',
      ),
      'Wallet removal must complete wallet-update auto-selection',
    );

    const allEvents = [
      ...initTrace.events,
      ...multiNumResult.trace.events,
      ...dappTrace.events,
      ...stressTrace.events,
      ...autoSelectTrace.events,
    ];
    assertTraceRequestResultPairs(allEvents);
    assertStaleReloadPostProcessPairs(allEvents);
    const summary = buildTraceSummary(allEvents);
    const performanceBudgets = evaluatePerformanceBudgets(summary);
    assert.deepEqual(
      summary.fanout.selectionTransitions.duplicateConsumers,
      [],
      'A selection transition must not commit twice in the same consumer',
    );
    assert.deepEqual(
      summary.fanout.activeReloads.duplicateConsumers,
      [],
      'An active reload must not commit twice in the same consumer',
    );
    const report = {
      cycle,
      cdpExceptionCount: cdpExceptions.length,
      cdpExceptions,
      iterations,
      pageErrorCount: pageErrors.length,
      pageErrors,
      phaseSummaries: {
        autoSelect: buildTraceSummary(autoSelectTrace.events),
        dapp: buildTraceSummary(dappTrace.events),
        initialization: buildTraceSummary(initTrace.events),
        multiNumCustomNetwork: buildTraceSummary(multiNumResult.trace.events),
        stress: buildTraceSummary(stressTrace.events),
      },
      performanceBudgets,
      summary,
    };
    fs.writeFileSync(
      path.join(artifactDir, `cycle-${cycle}-summary.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(artifactDir, `cycle-${cycle}-trace.json`),
      `${JSON.stringify(
        {
          phases: {
            autoSelect: autoSelectTrace,
            dapp: dappTrace,
            initialization: initTrace,
            multiNumCustomNetwork: multiNumResult.trace,
            stress: stressTrace,
          },
        },
        null,
        2,
      )}\n`,
    );
    assertPerformanceBudgets(performanceBudgets);
    assert.deepEqual(pageErrors, [], 'Web page emitted uncaught errors');
    assert.deepEqual(
      cdpExceptions,
      [],
      'CDP Runtime emitted uncaught exceptions',
    );
    log(
      `cycle#${cycle}: passed (${summary.totalEvents} trace events, ` +
        `${summary.providerRenders.commitCount} provider commits)`,
    );
    return report;
  } catch (error) {
    const screenshotPath = path.join(artifactDir, `cycle-${cycle}-failure.png`);
    fs.writeFileSync(
      path.join(artifactDir, `cycle-${cycle}-exceptions.json`),
      `${JSON.stringify({ cdpExceptions, pageErrors }, null, 2)}\n`,
    );
    await page
      .screenshot({ path: screenshotPath, fullPage: true })
      .catch(() => {});
    log(`cycle#${cycle}: failure screenshot ${screenshotPath}`);
    throw error;
  } finally {
    await context.close().catch(() => {});
    assert.equal(
      browser.contexts().length,
      0,
      `cycle#${cycle}: E2E context cleanup left residual tabs`,
    );
  }
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const { child: rendererProcess, rendererUrl } = await startWebRenderer();
  let browser;
  let cleanupPromise;
  const cleanup = () => {
    cleanupPromise ||= (async () => {
      if (browser) {
        await closeResidualE2EBrowserContexts(browser, 'shutdown').catch(
          () => {},
        );
        await browser.close().catch(() => {});
      }
      await stopProcess(rendererProcess);
    })();
    return cleanupPromise;
  };
  const handleSignal = (signal) => {
    log(`${signal}: clean E2E tabs before exit`);
    void cleanup().finally(() => {
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  };
  const handleSigInt = () => handleSignal('SIGINT');
  const handleSigTerm = () => handleSignal('SIGTERM');
  process.once('SIGINT', handleSigInt);
  process.once('SIGTERM', handleSigTerm);
  try {
    browser = await launchBrowser();
    await closeResidualE2EBrowserContexts(browser, 'startup preflight');
    if (configuredCycles === 0) {
      for (let cycle = 1; ; cycle += 1) {
        await runCycle({ browser, cycle, rendererUrl });
      }
    } else {
      for (let cycle = 1; cycle <= configuredCycles; cycle += 1) {
        await runCycle({ browser, cycle, rendererUrl });
      }
    }
  } finally {
    await cleanup();
    process.off('SIGINT', handleSigInt);
    process.off('SIGTERM', handleSigTerm);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
