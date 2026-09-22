/* global by, device, element, expect, waitFor */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const outputDir = process.env.HEATING_REPRO_OUTPUT_DIR;
const includeInactiveStep =
  process.env.HEATING_REPRO_INCLUDE_INACTIVE_STEP === '1';
const launchArgs = {
  detoxEnableSynchronization: 0,
  onekey_harness_mode: 1,
};
const targetWalletId = process.env.HEATING_REPRO_TARGET_WALLET_ID || 'hd-1';
const initialWalletId = process.env.HEATING_REPRO_INITIAL_WALLET_ID;
const allowInitialWalletFallback =
  process.env.HEATING_REPRO_ALLOW_INITIAL_WALLET_FALLBACK === '1';
const requireInitialFunded =
  process.env.HEATING_REPRO_REQUIRE_INITIAL_FUNDED === '1';
const requireTargetFunded =
  process.env.HEATING_REPRO_REQUIRE_TARGET_FUNDED === '1';
const escapedTargetWalletId = targetWalletId.replace(
  /[.*+?^${}()|[\]\\]/gu,
  '\\$&',
);
const prepareHomeTimeoutMs =
  Number(process.env.HEATING_REPRO_PREP_HOME_TIMEOUT_MS) || 90_000;
const actionLogPath = outputDir
  ? path.join(outputDir, 'action-timeline.jsonl')
  : null;
const runMetaPath = outputDir ? path.join(outputDir, 'run-meta.json') : null;
const preparedPath = outputDir ? path.join(outputDir, 'prepared.json') : null;
const formalEndPath = outputDir
  ? path.join(outputDir, 'formal-end.json')
  : null;
const interactionLogPath = outputDir
  ? path.join(outputDir, 'interaction-timeline.jsonl')
  : null;
const observationEndPath = outputDir
  ? path.join(outputDir, 'observation-end.json')
  : null;
let activeAction = null;
let interactionOrigin = null;

function recordInteraction(marker, detail = {}) {
  if (!interactionLogPath || !interactionOrigin) return;
  fs.appendFileSync(
    interactionLogPath,
    `${JSON.stringify({
      marker,
      at: new Date().toISOString(),
      elapsedSec: Number(
        ((performance.now() - interactionOrigin) / 1000).toFixed(3),
      ),
      action: activeAction,
      ...detail,
    })}\n`,
    'utf8',
  );
}

async function measuredTap(target, semanticTarget) {
  recordInteraction('tap-dispatched', {
    semanticTarget,
    source: 'host Detox dispatch',
  });
  await target.tap();
  recordInteraction('tap-completed', {
    semanticTarget,
    source: 'Detox acknowledgement; not visual feedback',
  });
}

const collectorReadyPath = outputDir
  ? path.join(outputDir, 'collector-ready.json')
  : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendAction(event) {
  if (!actionLogPath) return;
  fs.appendFileSync(actionLogPath, `${JSON.stringify(event)}\n`, 'utf8');
}

function writeRunMeta(meta) {
  if (!runMetaPath) return;
  fs.writeFileSync(runMetaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

async function waitForCollectorReady() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (collectorReadyPath && fs.existsSync(collectorReadyPath)) return;
    await sleep(50);
  }
  throw new Error('Host metric collector did not become ready within 30s');
}

async function writePreparationDiagnostics() {
  if (!outputDir) return;
  try {
    const hierarchy = await device.generateViewHierarchyXml();
    fs.writeFileSync(
      path.join(outputDir, 'preparation-view-hierarchy.xml'),
      hierarchy,
      'utf8',
    );
  } catch {
    // A hierarchy is best-effort when app startup itself failed.
  }
  try {
    await device.takeScreenshot('account-switch-heating-preparation-timeout');
  } catch {
    // Detox may have already disconnected while handling a launch failure.
  }
}

async function writeActionDiagnostics(label) {
  if (!outputDir) return;
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/gu, '-');
  try {
    const hierarchy = await device.generateViewHierarchyXml();
    fs.writeFileSync(
      path.join(outputDir, `failure-${safeLabel}-view-hierarchy.xml`),
      hierarchy,
      'utf8',
    );
  } catch {
    // The hierarchy is best-effort after an interaction failure.
  }
  try {
    await device.takeScreenshot(`account-switch-heating-${safeLabel}-failure`);
  } catch {
    // Detox may have disconnected before diagnostics are written.
  }
}

async function tapWhenVisible(target, timeoutMs = 4000) {
  await waitFor(target).toBeVisible().withTimeout(timeoutMs);
  await measuredTap(target, 'visible semantic target');
}

async function tapSemanticDescendantThroughAncestor(target, ancestor) {
  const targetAttributes = await target.getAttributes();
  const ancestorAttributes = await ancestor.getAttributes();
  const targetFrame = targetAttributes?.frame;
  const ancestorFrame = ancestorAttributes?.frame;
  if (
    targetAttributes?.visible !== true ||
    ancestorAttributes?.visible !== true ||
    !(targetFrame?.width > 0) ||
    !(targetFrame?.height > 0) ||
    !(ancestorFrame?.width > 0) ||
    !(ancestorFrame?.height > 0)
  ) {
    throw new Error(
      `Semantic target or ancestor does not expose a visible frame: ${JSON.stringify(
        {
          target: {
            visible: targetAttributes?.visible,
            hittable: targetAttributes?.hittable,
            frame: targetFrame,
          },
          ancestor: {
            visible: ancestorAttributes?.visible,
            hittable: ancestorAttributes?.hittable,
            frame: ancestorFrame,
          },
        },
      )}`,
    );
  }
  const screenRelativeX =
    targetFrame.x - ancestorFrame.x + targetFrame.width / 2;
  const screenRelativeY =
    targetFrame.y - ancestorFrame.y + targetFrame.height / 2;
  const localRelativeX = targetFrame.x + targetFrame.width / 2;
  const localRelativeY = targetFrame.y + targetFrame.height / 2;
  const x =
    screenRelativeX >= 0 && screenRelativeX <= ancestorFrame.width
      ? screenRelativeX
      : localRelativeX;
  const y =
    screenRelativeY >= 0 && screenRelativeY <= ancestorFrame.height
      ? screenRelativeY
      : localRelativeY;
  recordInteraction('tap-dispatched', {
    semanticTarget: 'visible semantic descendant',
    source: 'host Detox ancestor-frame fallback',
  });
  await ancestor.tap({
    x: Math.max(1, Math.min(ancestorFrame.width - 1, Math.floor(x))),
    y: Math.max(1, Math.min(ancestorFrame.height - 1, Math.floor(y))),
  });
  recordInteraction('tap-completed', {
    semanticTarget: 'visible semantic descendant',
    source: 'Detox acknowledgement; not visual feedback',
  });
}

async function tapSemanticTargetAtRuntimeFrame(
  target,
  semanticTarget = 'visible semantic frame',
) {
  const attributes = await target.getAttributes();
  const candidates = getAttributeCandidates(attributes);
  const targetAttributes =
    candidates.find(
      (item) => item?.visible && item?.hittable && item?.frame?.height > 0,
    ) || candidates.find((item) => item?.visible && item?.frame?.height > 0);
  const frame = targetAttributes?.frame;
  if (!(frame?.width > 0) || !(frame?.height > 0)) {
    throw new Error('Semantic target does not expose a frame');
  }
  recordInteraction('tap-dispatched', {
    semanticTarget,
    source: 'host Detox runtime-frame fallback',
  });
  await device.tap({
    x: Math.floor(frame.x + frame.width / 2),
    y: Math.floor(frame.y + frame.height / 2),
  });
  recordInteraction('tap-completed', {
    semanticTarget,
    source: 'Detox acknowledgement; not visual feedback',
  });
}

function getAttributeCandidates(attributes) {
  return Array.isArray(attributes?.elements)
    ? attributes.elements
    : [attributes];
}

function hasUsableFrame(attributes) {
  return attributes?.frame?.width > 0 && attributes?.frame?.height > 0;
}

async function findReportedVisibleById(testID, maxIndexes = 3) {
  for (let index = 0; index < maxIndexes; index += 1) {
    const candidate = element(by.id(testID)).atIndex(index);
    try {
      const attributes = await candidate.getAttributes();
      if (attributes?.visible && hasUsableFrame(attributes)) return candidate;
    } catch {
      // Continue past retained or unmounted native accessibility elements.
    }
  }
  const direct = element(by.id(testID));
  try {
    const attributes = await direct.getAttributes();
    const candidates = getAttributeCandidates(attributes);
    const visibleIndex = candidates.findIndex(
      (item) => item?.visible && hasUsableFrame(item),
    );
    if (visibleIndex >= 0) {
      return candidates.length === 1
        ? direct
        : element(by.id(testID)).atIndex(visibleIndex);
    }
  } catch {
    // The semantic node is not currently mounted.
  }
  return null;
}

async function waitForReportedVisibleById(testID, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const candidate = await findReportedVisibleById(testID);
    if (candidate) return candidate;
    await sleep(50);
  }
  return null;
}

async function tapUnifiedNetworkTab(testID) {
  const tab = element(by.id(testID)).atIndex(0);
  await waitFor(tab).toExist().withTimeout(5000);
  try {
    await measuredTap(tab, testID);
    return;
  } catch {
    // UIKit-backed controls may require their current visible ancestor frame.
  }
  const nativeSession = process.env.HEATING_REPRO_NATIVE_UI_SESSION;
  if (nativeSession) {
    if (!process.env.HEATING_REPRO_UDID) {
      throw new Error(
        'Native frame verification requires the runner device id',
      );
    }
    // EarlGrey can report clipped UIKit segment children as invisible while
    // XCTest sees the same accessibility identifier as hittable. Resolve its
    // current frame through XCTest instead of trusting a hidden Detox node.
    const response = JSON.parse(
      execFileSync(
        'agent-device',
        [
          'get',
          'attrs',
          `id="${testID}"`,
          '--session',
          nativeSession,
          '--platform',
          'ios',
          '--udid',
          process.env.HEATING_REPRO_UDID,
          '--session-lock',
          'reject',
          '--json',
        ],
        { encoding: 'utf8', timeout: 15_000 },
      ),
    );
    const node = response?.data?.node;
    const frame = node?.rect;
    if (
      response?.success !== true ||
      node?.identifier !== testID ||
      node?.hittable !== true ||
      node?.enabled !== true ||
      !(frame?.width > 0) ||
      !(frame?.height > 0)
    ) {
      throw new Error('Native semantic tab is not currently hittable');
    }
    recordInteraction('tap-dispatched', {
      semanticTarget: testID,
      source: 'current XCTest hittable testID frame',
    });
    await device.tap({
      x: Math.floor(frame.x + frame.width / 2),
      y: Math.floor(frame.y + frame.height / 2),
    });
    recordInteraction('tap-completed', {
      semanticTarget: testID,
      source: 'Detox acknowledgement; not visual feedback',
    });
    return;
  }
  const header = element(
    by.type('UINavigationBar').withDescendant(by.id(testID)),
  ).atIndex(0);
  await waitFor(header).toBeVisible().withTimeout(5000);
  await tapSemanticDescendantThroughAncestor(tab, header);
}

async function tapHomeNetworkTrigger(timeoutMs = 5000) {
  const allNetworksTrigger = element(
    by.id('all-networks-manager-trigger'),
  ).atIndex(0);
  try {
    await waitFor(allNetworksTrigger).toBeVisible().withTimeout(300);
    await measuredTap(allNetworksTrigger, 'all-networks-manager-trigger');
    return;
  } catch {
    // Single-network Home and builds predating the dedicated testID use this.
  }
  await tapWhenVisible(
    element(by.id('account-network-trigger-button')).atIndex(0),
    timeoutMs,
  );
}

async function tapTabLike(label, testID) {
  if (testID) {
    try {
      await element(by.id(testID)).atIndex(0).tap();
      return;
    } catch {
      // Native UIKit tabs can expose the testID on a clipped label child.
    }
  }
  try {
    await element(by.traits(['button']).withDescendant(by.text(label)))
      .atIndex(0)
      .tap();
  } catch {
    await element(by.text(label)).atIndex(0).tap();
  }
}

async function tapNavigationBack() {
  const backById = await findReportedVisibleById('nav-header-back');
  if (backById) {
    await measuredTap(backById, 'nav-header-back');
    return;
  }
  const backButton = await findVisibleByMatcher(by.label('Back'), 8, 120, 75);
  if (!backButton) throw new Error('Visible navigation back button not found');
  await measuredTap(backButton, 'Back label');
}

async function revealInNativeList(target, list) {
  try {
    await waitFor(target).toBeVisible().withTimeout(500);
    return;
  } catch {
    // Search both sides of the current virtualized viewport.
  }
  for (const direction of ['up', 'down']) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      await list.swipe(direction, 'fast', 0.7);
      try {
        await waitFor(target).toBeVisible().withTimeout(300);
        return;
      } catch {
        // Keep moving through the semantic list until the row is mounted.
      }
    }
  }
  await waitFor(target).toBeVisible().withTimeout(1000);
}

async function findVisibleByMatcher(
  matcher,
  maxIndexes = 4,
  timeoutMs = 120,
  visibilityPercent = 75,
) {
  const direct = element(matcher);
  try {
    await waitFor(direct).toBeVisible(visibilityPercent).withTimeout(timeoutMs);
    return direct;
  } catch {
    // Fall through when the first native match is a retained hidden cell.
  }
  for (let index = 0; index < maxIndexes; index += 1) {
    const candidate = element(matcher).atIndex(index);
    try {
      await waitFor(candidate)
        .toBeVisible(visibilityPercent)
        .withTimeout(timeoutMs);
      return candidate;
    } catch {
      // NativeList can retain hidden cells with the same semantic identifier.
    }
  }
  return null;
}

async function isStockDetailOpen(timeoutMs) {
  try {
    await waitFor(element(by.id('market-detail-page')).atIndex(0))
      .toExist()
      .withTimeout(timeoutMs);
    return true;
  } catch {
    return Boolean(await findReportedVisibleById('nav-header-back', 8));
  }
}

async function openAccountSelector() {
  const trigger = element(by.id('AccountSelectorTriggerBase'));
  await waitFor(trigger).toBeVisible().withTimeout(4000);
  await measuredTap(trigger, 'AccountSelectorTriggerBase');
  await waitFor(element(by.id('account-selector-accountList')))
    .toExist()
    .withTimeout(5000);
  await waitFor(element(by.id('account-selector-header')))
    .toBeVisible()
    .withTimeout(5000);
  recordInteraction('modal-visible', {
    semanticTarget: 'account-selector-header',
    source: 'first successful semantic visibility observation',
  });
}

async function waitForHomeReady(timeoutMs) {
  await waitFor(element(by.id('home-page')))
    .toExist()
    .withTimeout(timeoutMs);
  await waitFor(element(by.id('AccountSelectorTriggerBase')))
    .toBeVisible()
    .withTimeout(timeoutMs);
  recordInteraction('home-visible', {
    semanticTarget: 'AccountSelectorTriggerBase',
    source:
      'Home exists and trigger visible; input readiness and account-effective state are unmeasured',
  });
}

async function selectWalletByMatcher(matcher) {
  const findWalletList = async () => {
    for (const testID of [
      'account-selector-wallet-list-v2',
      'account-selector-wallet-list',
    ]) {
      const candidate = element(by.id(testID)).atIndex(0);
      try {
        await waitFor(candidate).toExist().withTimeout(500);
        return candidate;
      } catch {
        // Try the account-selector implementation used by the other layout.
      }
    }
    throw new Error('Account selector wallet list is not mounted');
  };

  let walletList;
  try {
    walletList = await findWalletList();
  } catch {
    await openAccountSelector();
    walletList = await findWalletList();
  }
  const wallet = element(matcher).atIndex(0);
  try {
    await revealInNativeList(wallet, walletList);
  } catch {
    await openAccountSelector();
    walletList = await findWalletList();
    await revealInNativeList(wallet, walletList);
  }
  await measuredTap(wallet, 'visible-wallet-row');
  await waitFor(element(by.id('account-selector-accountList')))
    .toExist()
    .withTimeout(5000);
  await waitFor(element(by.id('account-item-index-0')))
    .toBeVisible()
    .withTimeout(5000);
}

async function selectTargetWallet() {
  await selectWalletByMatcher(by.id(`wallet-${targetWalletId}`));
}

async function selectInitialWallet() {
  if (initialWalletId) {
    await selectWalletByMatcher(by.id(`wallet-${initialWalletId}`));
    return 'explicit';
  }
  try {
    await selectWalletByMatcher(by.id(/^wallet-hw-/u));
    return 'hardware';
  } catch (error) {
    if (!allowInitialWalletFallback) throw error;
    await selectWalletByMatcher(
      by.id(new RegExp(`^wallet-(?!${escapedTargetWalletId}$).+`, 'u')),
    );
    return 'non-target-fallback';
  }
}

async function waitForAccountSelectorClosed(timeoutMs) {
  const header = element(by.id('account-selector-header'));
  const deadline = Date.now() + timeoutMs;
  let closed = false;
  while (Date.now() < deadline) {
    try {
      const attributes = await header.getAttributes();
      closed = getAttributeCandidates(attributes).every(
        (candidate) => candidate?.visible === false,
      );
    } catch {
      // A dismissed native sheet can unmount rather than stay hidden.
      await expect(header).not.toExist();
      closed = true;
    }
    if (closed) break;
    await sleep(50);
  }
  if (!closed) throw new Error('Account selector did not close');
  recordInteraction('modal-hidden', {
    semanticTarget: 'account-selector-header',
  });
}

async function selectAccountByIndex(index, closeTimeoutMs = 30_000) {
  const itemMatcher = by.id(`account-item-index-${index}`);
  const list = await findVisibleByMatcher(
    by.id('account-selector-accountList'),
    4,
    200,
    25,
  );
  if (!list) throw new Error('Visible account list not found');
  let item = await findVisibleByMatcher(itemMatcher, 4, 200, 50);
  if (!item) {
    await revealInNativeList(element(itemMatcher), list);
    item = await findVisibleByMatcher(itemMatcher, 4, 200, 50);
  }
  if (!item) throw new Error(`Visible account item not found: ${index}`);
  // NativeList's semantic tap can acknowledge without invoking the row.
  // Use the frame of this currently visible testID for one effective tap.
  await tapSemanticTargetAtRuntimeFrame(item, `account-item-index-${index}`);
  await waitForAccountSelectorClosed(closeTimeoutMs);
}

async function readHomeHasVisibleBalance() {
  const balance = element(by.id('home-total-balance'));
  const nonZeroBalance = element(
    by
      .id('home-total-balance')
      .withDescendant(by.text(/^[$¥€£]\s*(?!0(?:[.,]0+)?$)[\d,]+(?:\.\d+)?$/u)),
  );
  try {
    await waitFor(nonZeroBalance).toExist().withTimeout(10_000);
    return true;
  } catch {
    await waitFor(balance).toExist().withTimeout(1000);
    return false;
  }
}

async function isBscHome() {
  try {
    await waitFor(element(by.id(/^home-token-item-evm--56-.+/u)).atIndex(0))
      .toExist()
      .withTimeout(500);
    return true;
  } catch {
    return false;
  }
}

async function ensureBscSelected() {
  if (await isBscHome()) return;
  await tapHomeNetworkTrigger(15_000);
  await sleep(500);

  let bscItem = await waitForReportedVisibleById('evm--56', 1200);
  if (!bscItem) {
    await tapUnifiedNetworkTab('chain-selector-unified-single-network-tab');
    bscItem = await waitForReportedVisibleById('evm--56', 5000);
  }
  if (!bscItem) throw new Error('BNB Chain semantic item is not visible');
  await tapSemanticTargetAtRuntimeFrame(bscItem);

  const confirmButton = await waitForReportedVisibleById(
    'page-footer-confirm',
    800,
  );
  if (confirmButton) await measuredTap(confirmButton, 'page-footer-confirm');
  await waitForHomeReady(10_000);
  if (!(await isBscHome())) {
    throw new Error('Home did not switch to BNB Chain');
  }
}

async function switchProductAccount(index) {
  await openAccountSelector();
  await selectAccountByIndex(index);
  await waitForHomeReady(5000);
}

async function tapBottomTab(label) {
  const testIDs = {
    Discover: 'bottom-tab-Discovery',
    Perps: /^bottom-tab-(?:Perp|WebviewPerpTrade)$/u,
    Trade: 'bottom-tab-Swap',
    Wallet: 'bottom-tab-Home',
  };
  const testID = testIDs[label];
  const nativeTab = element(by.id(testID)).atIndex(0);
  await waitFor(nativeTab).toExist().withTimeout(3000);
  try {
    await measuredTap(nativeTab, `bottom-tab-${label}`);
  } catch {
    // iOS 26 Liquid Glass can cover the semantic tab node for EarlGrey's
    // 100%-visible assertion even though the underlying button is hittable.
    await tapSemanticTargetAtRuntimeFrame(nativeTab);
  }
}

async function enterMarketStocks() {
  await tapBottomTab('Discover');
  const marketHeaderTab = element(by.id('discovery-header-tab-market')).atIndex(
    0,
  );
  try {
    await tapWhenVisible(marketHeaderTab, 500);
  } catch {
    const visibleMarketText = await findVisibleByMatcher(by.text('Market'));
    if (!visibleMarketText)
      throw new Error('Visible Market header tab not found');
    await measuredTap(visibleMarketText, 'Market header');
  }
  await waitFor(element(by.id('market-native-collapsible-pager')).atIndex(0))
    .toExist()
    .withTimeout(5000);
  await selectMarketStocksTab();
}

async function selectMarketStocksTab() {
  const stocksTab = element(by.id('market-native-tab-2')).atIndex(0);
  try {
    await measuredTap(stocksTab, 'market-native-tab-2');
  } catch {
    await tapSemanticTargetAtRuntimeFrame(stocksTab);
  }
  await waitFor(element(by.id('market-stock-list')).atIndex(0))
    .toExist()
    .withTimeout(5000);
}

async function openStock(symbol) {
  const rowMatcher = by.id(`market-stock-row-${symbol}`);
  let list = await findVisibleByMatcher(by.id('market-stock-list'), 4, 300, 25);
  if (!list) throw new Error('Visible stock list not found');

  for (const direction of ['up', 'down']) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const row = await findVisibleByMatcher(rowMatcher, 4, 80, 50);
      if (row) {
        try {
          await measuredTap(row, 'visible-market-row');
          if (await isStockDetailOpen(2500)) return;
        } catch {
          // NativeList cells can reject EarlGrey's visibility precondition.
        }
        try {
          await tapSemanticTargetAtRuntimeFrame(row);
          if (await isStockDetailOpen(2500)) return;
        } catch {
          // A retained duplicate can disappear between matching and tapping.
        }
      }
      list =
        (await findVisibleByMatcher(by.id('market-stock-list'), 4, 120, 25)) ||
        list;
      await list.swipe(direction, 'slow', 0.25);
      await sleep(150);
    }
  }
  throw new Error(`Visible stock row did not open detail: ${symbol}`);
}

async function returnFromMarketDetail(
  expectedListTestID = 'market-stock-list',
) {
  await tapNavigationBack();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const list = await findVisibleByMatcher(
      by.id(expectedListTestID),
      4,
      120,
      25,
    );
    if (list) return;
    await sleep(80);
  }
  throw new Error(
    `${expectedListTestID} did not become visible after returning`,
  );
}

async function enterMarketFavorites(filter) {
  await tapBottomTab('Discover');
  await sleep(800);
  await tapTabLike('Favorites');
  await tapTabLike(filter);
  await waitFor(element(by.id('market-watch-list')))
    .toExist()
    .withTimeout(5000);
}

async function openFirstFavoriteToken() {
  const row = element(
    by.id(/^market-token-item-.+/u).withAncestor(by.id('market-watch-list')),
  ).atIndex(0);
  await waitFor(row).toBeVisible(100).withTimeout(15_000);
  await measuredTap(row, 'visible-market-row');
  await waitFor(element(by.label('Back')).atIndex(0))
    .toExist()
    .withTimeout(5000);
}

async function prepareInitialState() {
  try {
    await device.terminateApp();
  } catch {
    // The app may already be terminated before Detox attaches.
  }
  await sleep(1000);
  await device.launchApp({
    newInstance: true,
    launchArgs,
  });
  await device.disableSynchronization();
  try {
    await waitForHomeReady(prepareHomeTimeoutMs);
  } catch (error) {
    await writePreparationDiagnostics();
    throw error;
  }
  await openAccountSelector();
  await selectTargetWallet();
  const accountList = element(by.id('account-selector-accountList'));
  await revealInNativeList(element(by.id('account-item-index-5')), accountList);
  await revealInNativeList(element(by.id('account-item-index-0')), accountList);
  await selectAccountByIndex(0);
  await waitForHomeReady(5000);
  const targetWalletFunded = await readHomeHasVisibleBalance();
  if (requireTargetFunded && !targetWalletFunded) {
    throw new Error('Target wallet does not expose a non-zero Home balance');
  }

  await ensureBscSelected();
  await sleep(1500);

  await openAccountSelector();
  const initialWalletSelector = await selectInitialWallet();
  await selectAccountByIndex(0);
  const initialWalletFunded = await readHomeHasVisibleBalance();
  if (requireInitialFunded && !initialWalletFunded) {
    throw new Error('Initial wallet does not expose a non-zero Home balance');
  }
  await sleep(2000);
  await device.terminateApp();
  await sleep(1500);
  return {
    initialWalletFunded,
    initialWalletSelector,
    targetWalletFunded,
  };
}

describe('iOS account-switch heating regression timeline', () => {
  beforeAll(() => {
    if (!outputDir) {
      throw new Error('HEATING_REPRO_OUTPUT_DIR is required');
    }
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(actionLogPath, '', 'utf8');
    fs.writeFileSync(interactionLogPath, '', 'utf8');
  });

  it('replays the QA timeline using semantic selectors', async () => {
    let preparation;
    try {
      preparation = await prepareInitialState();
    } catch (error) {
      await writePreparationDiagnostics();
      throw error;
    }
    fs.writeFileSync(
      preparedPath,
      `${JSON.stringify({ preparedAt: new Date().toISOString(), preparation })}\n`,
      'utf8',
    );
    await waitForCollectorReady();

    const originMono = performance.now();
    const originWall = Date.now();
    interactionOrigin = originMono;
    const runMeta = {
      formalStartedAt: new Date(originWall).toISOString(),
      includeInactiveStep,
      preparation,
      status: 'running',
    };
    writeRunMeta(runMeta);

    const runAt = async (plannedSec, label, action) => {
      const target = originMono + plannedSec * 1000;
      const waitMs = target - performance.now();
      if (waitMs > 0) await sleep(waitMs);

      const startedMono = performance.now();
      const startedWall = Date.now();
      let error;
      activeAction = label.replace(
        /(?:hd|hw|imported|watching)-[\w-]+/gu,
        '[wallet]',
      );
      try {
        await action();
      } catch (actionError) {
        error = actionError;
      }
      const endedMono = performance.now();
      activeAction = null;
      appendAction({
        label: label.replace(
          /(?:hd|hw|imported|watching)-[\w-]+/gu,
          '[wallet]',
        ),
        plannedSec,
        startedSec: Number(((startedMono - originMono) / 1000).toFixed(3)),
        endedSec: Number(((endedMono - originMono) / 1000).toFixed(3)),
        durationMs: Math.round(endedMono - startedMono),
        driftMs: Math.round(startedMono - target),
        startedAt: new Date(startedWall).toISOString(),
        ok: !error,
        ...(error ? { error: String(error?.message || error) } : {}),
      });
      if (error) {
        await writeActionDiagnostics(label);
        throw new Error(String(error?.message || error));
      }
    };

    await runAt(0, 'cold launch', async () => {
      await device.launchApp({
        newInstance: true,
        launchArgs,
      });
      await device.disableSynchronization();
    });
    await runAt(5, 'open account selector', openAccountSelector);
    await runAt(5.4, 'select product wallet', async () => {
      await selectTargetWallet();
    });
    await runAt(
      6,
      `switch initial wallet to ${targetWalletId}--0`,
      async () => {
        await selectAccountByIndex(0);
      },
    );
    await runAt(7, 'return Home', async () => {
      await waitForHomeReady(5000);
    });

    await runAt(10, 'open Trade / Swap', async () => {
      await tapBottomTab('Trade');
    });
    await runAt(10.5, 'open Discover Market', enterMarketStocks);
    await runAt(12, 'open AAPL', async () => openStock('AAPL'));
    await runAt(15, 'return from AAPL', returnFromMarketDetail);
    await runAt(17, 'open GOOGL', async () => openStock('GOOGL'));
    await runAt(21, 'return from GOOGL', returnFromMarketDetail);
    await runAt(22, 'open GOOG', async () => openStock('GOOG'));
    await runAt(25, 'return from GOOG', returnFromMarketDetail);
    await runAt(26, 'open MSFT', async () => openStock('MSFT'));
    await runAt(29, 'return from MSFT', returnFromMarketDetail);
    await runAt(31, 'open AMZN', async () => openStock('AMZN'));
    await runAt(39, 'return from AMZN', returnFromMarketDetail);

    await runAt(41, 'open Wallet / Home', async () => {
      await tapBottomTab('Wallet');
    });
    await runAt(42, `BSC switch ${targetWalletId}--0 to --1`, async () => {
      await switchProductAccount(1);
    });
    await runAt(45, `BSC switch ${targetWalletId}--1 to --2`, async () => {
      await switchProductAccount(2);
    });

    await runAt(48, 'open Trade / Swap again', async () => {
      await tapBottomTab('Trade');
    });
    await runAt(49, 'open Perps', async () => {
      await tapBottomTab('Perps');
    });
    await runAt(49.3, 'immediately open Discover Market', enterMarketStocks);
    await runAt(50, 'open GOOG second phase', async () => openStock('GOOG'));
    await runAt(53, 'return from GOOG second phase', returnFromMarketDetail);
    await runAt(54, 'open TSM', async () => openStock('TSM'));
    await runAt(56, 'return from TSM', returnFromMarketDetail);
    await runAt(58, 'open GOOG for 9 seconds', async () => openStock('GOOG'));
    await runAt(67, 'return from GOOG after dwell', returnFromMarketDetail);
    await runAt(69, 'open META', async () => openStock('META'));
    await runAt(71, 'return from META', returnFromMarketDetail);

    if (includeInactiveStep) {
      await runAt(72, 'send app to Home', async () => {
        await device.sendToHome();
      });
      await runAt(73, 'resume app', async () => {
        await device.launchApp({
          newInstance: false,
          launchArgs,
        });
        await device.disableSynchronization();
      });
    }

    await runAt(74, 'open Wallet / Home after Market', async () => {
      await tapBottomTab('Wallet');
    });
    await runAt(75, `BSC switch ${targetWalletId}--2 to --4`, async () => {
      await switchProductAccount(4);
    });

    await runAt(80, 'open Market Watchlist crypto', async () => {
      await enterMarketFavorites('Crypto');
      await openFirstFavoriteToken();
    });
    await runAt(88, 'return and open VOO', async () => {
      await returnFromMarketDetail('market-watch-list');
      await selectMarketStocksTab();
      await openStock('VOO');
    });
    await runAt(92, 'return from VOO', returnFromMarketDetail);
    await runAt(
      93,
      'open Wallet / Home before rapid BSC switches',
      async () => {
        await tapBottomTab('Wallet');
      },
    );

    await runAt(95, `BSC switch ${targetWalletId}--4 to --0`, async () => {
      await switchProductAccount(0);
    });
    await runAt(98, `BSC switch ${targetWalletId}--0 to --1`, async () => {
      await switchProductAccount(1);
    });
    await runAt(101, `BSC switch ${targetWalletId}--1 to --5`, async () => {
      await switchProductAccount(5);
    });
    await runAt(104, `BSC switch ${targetWalletId}--5 to --4`, async () => {
      await switchProductAccount(4);
    });
    await runAt(
      108,
      'open account selector without switching',
      openAccountSelector,
    );
    await runAt(110, 'enter Unified Network Selector', async () => {
      await selectAccountByIndex(4);
      await tapHomeNetworkTrigger();
    });
    await runAt(114, 'select and confirm All Networks', async () => {
      await tapUnifiedNetworkTab('chain-selector-unified-all-networks-tab');
      await waitFor(element(by.id('page-footer-confirm')))
        .toExist()
        .withTimeout(5000);
      await tapWhenVisible(element(by.id('page-footer-confirm')), 5000);
      try {
        await device.matchFace();
      } catch {
        // Biometric authentication is optional on simulator.
      }
    });
    await runAt(121, 'confirm All Networks Home', async () => {
      await waitForHomeReady(5000);
      try {
        await waitFor(element(by.id('all-networks-manager-trigger')).atIndex(0))
          .toExist()
          .withTimeout(1000);
      } catch {
        // Compatibility for an already-installed build using the shared ID.
        await waitFor(
          element(by.id('account-network-trigger-button')).atIndex(0),
        )
          .toBeVisible()
          .withTimeout(5000);
      }
    });

    await runAt(
      127,
      `All Networks switch ${targetWalletId}--4 to --0`,
      async () => {
        await switchProductAccount(0);
      },
    );
    await runAt(
      134,
      `All Networks switch ${targetWalletId}--0 to --2`,
      async () => {
        await switchProductAccount(2);
      },
    );
    await runAt(
      140,
      `All Networks switch ${targetWalletId}--2 to --3`,
      async () => {
        await switchProductAccount(3);
      },
    );
    await runAt(
      146,
      `All Networks switch ${targetWalletId}--3 to --5`,
      async () => {
        await switchProductAccount(5);
      },
    );
    await runAt(
      157,
      `All Networks switch ${targetWalletId}--5 to --1`,
      async () => {
        await switchProductAccount(1);
      },
    );
    await runAt(
      168,
      `All Networks switch ${targetWalletId}--1 to --5`,
      async () => {
        await switchProductAccount(5);
      },
    );

    await runAt(176, 'open More Actions', async () => {
      await tapWhenVisible(element(by.id('moreActions')), 5000);
    });
    await runAt(178, 'open Action Center', async () => {
      await waitFor(element(by.id('action-center-page-body')))
        .toExist()
        .withTimeout(5000);
    });
    await runAt(180, 'open About', async () => {
      try {
        await tapWhenVisible(
          element(by.id('action-center-about')).atIndex(0),
          1000,
        );
      } catch {
        // Compatibility for an already-installed build without the testID.
        await tapWhenVisible(element(by.text('About OneKey')).atIndex(0), 5000);
      }
    });
    await runAt(181, 'export state logs', async () => {
      const formalEndedAt = new Date().toISOString();
      if (formalEndPath) {
        fs.writeFileSync(
          formalEndPath,
          `${JSON.stringify({ formalEndedAt })}\n`,
          'utf8',
        );
      }
      await tapWhenVisible(
        element(by.id('setting-export-diagnostic-logs')).atIndex(0),
        5000,
      );
      try {
        await tapWhenVisible(element(by.id('dialog-confirm-btn')), 1500);
      } catch {
        // Some builds start local log export without a confirmation dialog.
      }
      await sleep(45_000);
    });
    const completedFormalEndedAt = JSON.parse(
      fs.readFileSync(formalEndPath, 'utf8'),
    ).formalEndedAt;
    writeRunMeta({
      ...runMeta,
      formalEndedAt: completedFormalEndedAt,
      durationMs: new Date(completedFormalEndedAt).getTime() - originWall,
      exportRequested: true,
      qaTimelineCompletedAt: new Date().toISOString(),
    });

    // Keep the original export action/timing intact. Observe only after its
    // diagnostic work and the extra navigation have been identified separately.
    activeAction = 'post-diagnostic return Home';
    recordInteraction('diagnostic-ended');
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (
        await findVisibleByMatcher(by.id('AccountSelectorTriggerBase'), 1, 100)
      ) {
        break;
      }
      let dismissed = false;
      const nativeClose = await findVisibleByMatcher(by.label('Close'), 4, 120);
      if (nativeClose) {
        try {
          await measuredTap(nativeClose, 'native Close label');
          dismissed = true;
        } catch {
          // A retained Close node may belong to a covered native page.
        }
      }
      if (!dismissed) {
        for (const testID of [
          'dialog-bounded-close',
          'dialog-cancel-btn',
          'nav-header-back',
          'nav-header-close',
        ]) {
          const close = await findReportedVisibleById(testID);
          if (close) {
            try {
              await measuredTap(close, testID);
              dismissed = true;
              break;
            } catch {
              // iOS share sheets can dismiss on their backdrop. The visible
              // navigation control supplies a current testID frame above it.
              await tapSemanticTargetAtRuntimeFrame(close, testID);
              dismissed = true;
              break;
            }
          }
        }
      }
      if (!dismissed) {
        const homeTab = await findReportedVisibleById('bottom-tab-Home');
        if (homeTab) {
          await tapBottomTab('Wallet');
          break;
        }
        throw new Error(
          'No semantic dismissal or Home target after diagnostic export',
        );
      }
    }
    await waitForHomeReady(5000);
    const observation = {
      kind: 'post-diagnostic Home cooldown',
      startedAt: new Date().toISOString(),
      note: 'Export remains on the QA schedule. This is not immediate post-QA idle.',
    };
    activeAction = null;
    recordInteraction('cooldown-started');
    await sleep(60_000);
    observation.endedAt = new Date().toISOString();
    recordInteraction('cooldown-ended');
    fs.writeFileSync(
      observationEndPath,
      `${JSON.stringify(observation)}\n`,
      'utf8',
    );

    const formalEndedAt = fs.existsSync(formalEndPath)
      ? JSON.parse(fs.readFileSync(formalEndPath, 'utf8')).formalEndedAt
      : new Date().toISOString();
    writeRunMeta({
      ...runMeta,
      collectionEndedAt: new Date().toISOString(),
      formalEndedAt,
      durationMs: new Date(formalEndedAt).getTime() - originWall,
      exportRequested: true,
      observation,
      status: 'completed',
    });
  });
});
