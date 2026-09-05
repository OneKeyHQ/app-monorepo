import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';

import { transformSync } from '@swc/core';

function createPortfolioRequestHarness() {
  const source = readFileSync(join(__dirname, 'TokenListBlock.tsx'), 'utf8');
  const finish = source.slice(
    source.indexOf('const finishPortfolioSyncRequest ='),
    source.indexOf('const completePortfolioSyncRequest ='),
  );
  const transition = source.slice(
    source.indexOf('const transitionPortfolioSyncRequest ='),
    source.indexOf('const syncTokenFilterToOverview ='),
  );
  const closeCallbackIndex = source.indexOf('const cancelPortfolioSync =');
  const closeEffect = source.slice(
    source.lastIndexOf('useEffect(() => {', closeCallbackIndex),
    source.indexOf('useEffect(() => {', closeCallbackIndex),
  );
  const requestRef: {
    current: { id: number; targetKey: string; phase: string } | undefined;
  } = { current: { id: 1, targetKey: 'device-1', phase: 'refreshing' } };
  const bus = new EventEmitter();
  const setPhase = jest.fn();
  let cleanup: (() => void) | undefined;
  const module = {
    exports: {} as { transition: (id: number, phase: string) => boolean },
  };
  // Execute the production callbacks, including their event subscription, without
  // mounting the unrelated token list, wallet services and network polling.
  runInNewContext(
    transformSync(
      `${finish}\n${transition}\n${closeEffect}\nmodule.exports = { transition: transitionPortfolioSyncRequest };`,
      {
        jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
      },
    ).code,
    {
      module,
      useCallback: (callback: unknown) => callback,
      useEffect: (effect: () => () => void) => {
        cleanup = effect();
      },
      portfolioSyncRequestRef: requestRef,
      getCurrentPortfolioSyncRequest: () => requestRef.current,
      setPortfolioSyncRequestPhase: setPhase,
      clearPortfolioSyncFallbackTimer: jest.fn(),
      allowEmptyInteractivePortfolioSyncRequestIdRef: { current: undefined },
      appEventBus: bus,
      EAppEventBusNames: { CloseHardwareUiStateDialogManually: 'close' },
    },
  );
  return {
    requestRef,
    bus,
    setPhase,
    transition: module.exports.transition,
    cleanup: () => cleanup?.(),
  };
}

describe('TokenListBlock portfolio sync producer', () => {
  it('claims communication only once when two refreshes finish for the same tap', () => {
    const harness = createPortfolioRequestHarness();
    expect(harness.transition(1, 'communicating')).toBe(true);
    expect(harness.transition(1, 'communicating')).toBe(false);
    expect(harness.transition(1, 'settled')).toBe(false);
    expect(harness.requestRef.current?.phase).toBe('communicating');
    harness.cleanup();
  });

  it('clears the request on user close and ignores a late refresh from that tap', () => {
    const harness = createPortfolioRequestHarness();
    expect(harness.transition(1, 'communicating')).toBe(true);
    harness.bus.emit('close');
    expect(harness.requestRef.current).toBeUndefined();
    expect(harness.setPhase).toHaveBeenLastCalledWith(undefined);
    expect(harness.transition(1, 'communicating')).toBe(false);
    harness.requestRef.current = {
      id: 2,
      targetKey: 'device-1',
      phase: 'refreshing',
    };
    expect(harness.transition(1, 'communicating')).toBe(false);
    expect(harness.transition(2, 'communicating')).toBe(true);
    harness.cleanup();
    expect(harness.bus.listenerCount('close')).toBe(0);
  });

  it('checks the Protocol V2 device type before building the cross-runtime payload', () => {
    const source = readFileSync(join(__dirname, 'TokenListBlock.tsx'), 'utf8');
    const buttonSource = readFileSync(
      join(__dirname, 'PortfolioSyncButton.tsx'),
      'utf8',
    );
    const gateIndex = source.indexOf(
      'isProtocolV2ProductType(portfolioSyncDeviceType) &&',
    );
    const buildIndex = source.indexOf(
      'const flattenedAggregateTokenMap = flattenAggregateTokensMap',
    );
    const sendToBackgroundIndex = source.indexOf(
      'backgroundApiProxy.serviceHardwarePortfolioSync.notifyAllNetworksTokenListSettled',
    );
    const emptySnapshotGateIndex = source.indexOf(
      'shouldDeferEmptyHardwarePortfolioSync({',
    );

    expect(source).not.toContain('useDevSettingsPersistAtom');
    expect(source).toContain(
      'deviceDbId: device?.id ?? wallet.associatedDeviceInfo?.id',
    );
    expect(source).not.toContain('isPro2DebugModuleEnabled');
    expect(source).toContain(
      'accountUtils.isHwWallet({ walletId: wallet.id })',
    );
    expect(source).toContain(
      '!accountUtils.isQrWallet({ walletId: wallet.id })',
    );
    expect(source).toContain('assetStatusCurrency &&');
    expect(source).toContain('if (!snapshot || isStaleOwnerRequest())');
    expect(source).toContain('clearRetainedResultOnAcceptedRun: true');
    expect(source).toContain('totalFiatCurrency: assetStatusCurrency');
    expect(gateIndex).toBeGreaterThan(0);
    expect(gateIndex).toBeLessThan(buildIndex);
    expect(buildIndex).toBeLessThan(sendToBackgroundIndex);
    expect(source).toContain('countFundedHardwarePortfolioTokens');
    expect(source).toContain('totalTokenCount: fundedTokenCount');
    expect(emptySnapshotGateIndex).toBeGreaterThan(buildIndex);
    expect(emptySnapshotGateIndex).toBeLessThan(sendToBackgroundIndex);
    expect(source).not.toContain(
      'appEventBus.emit(EAppEventBusNames.AllNetworksTokenListSettled',
    );
    expect(source).not.toContain('interactivePortfolioSyncRequestedRef');
    expect(source).toContain('const portfolioSyncRequestRef = useRef<');
    expect(source).toContain('buildPortfolioSyncTargetKey({');
    expect(source).toContain("phase: 'queued'");
    expect(source).toContain("'communicating'");
    expect(source).toContain('finishPortfolioSyncRequest');
    expect(source).toContain(
      'backgroundApiProxy.serviceHardwarePortfolioSync.syncPortfolio',
    );
    expect(source).toContain('const portfolioSyncPayload = {');
    expect(source).toContain('eventPayload: portfolioSyncPayload');
    expect(source.match(/syncMode: 'interactive'/g)).toHaveLength(2);
    expect(source).toContain('networkId: network.id');
    expect(source).toContain('networkId: network?.id');
    expect(source.match(/const portfolioSynced =/g)).toHaveLength(2);
    expect(source.match(/if \(portfolioSynced\) \{/g)).toHaveLength(2);
    expect(source).toContain('const handleSyncPortfolio = useCallback(() => {');
    expect(source).toContain('<PortfolioSyncButton');
    expect(source).toContain('const showPortfolioSyncButton = Boolean(');
    expect(source).not.toContain('isWalletConnected(wallet)');
    expect(source).toContain(
      'device?.deviceType ?? wallet?.associatedDeviceInfo?.deviceType',
    );
    expect(
      source.match(/isProtocolV2ProductType\(portfolioSyncDeviceType\)/g),
    ).toHaveLength(3);
    expect(source).toMatch(
      /!hasPortfolioSyncTarget \|\|\s+hardwareUiState \|\|\s+firmwareUpdateWorkflowRunning/,
    );
    expect(source).toContain(
      'const isInteractivePortfolioSync = Boolean(portfolioSyncRequest);',
    );
    expect(source).toMatch(
      /!isInteractivePortfolioSync &&\s+assetStatusAggregationComplete/,
    );
    expect(source).toContain('return renderPortfolioSyncButton();');
    expect(source).toContain('useFirmwareUpdateWorkflowRunningAtom');
    expect(source).toContain('completePortfolioSyncRequest');
    expect(source).toContain("setPortfolioSyncFeedback('success')");
    expect(source).toContain('keepPortfolioSyncRequest');
    expect(source).toContain('skipPortfolioSyncRequestFinish');
    expect(source).toContain(
      'const singleNetworkRefreshGenerationRef = useRef(0);',
    );
    expect(source).toMatch(
      /skipPortfolioSyncRequestFinish =\s+singleNetworkRefreshGeneration <\s+singleNetworkRefreshGenerationRef\.current;/,
    );
    expect(source).not.toContain('allowEmptyInteractivePortfolioSyncRef');
    expect(source).toMatch(
      /const allowEmptyInteractivePortfolioSyncRequestIdRef = useRef<\s+number \| undefined\s+>\(undefined\);/,
    );
    expect(source).toMatch(
      /allowEmptyInteractivePortfolioSyncRequestIdRef\.current ===\s+portfolioSyncRequest\.id/,
    );
    expect(source).toMatch(
      /if \(phase !== 'settled'\) \{\s+clearPortfolioSyncFallbackTimer\(\);/,
    );
    expect(source).toMatch(
      /portfolioSyncRequest &&\s+!skipPortfolioSyncRequestFinish &&\s+\(ownsPortfolioSyncCommunication \|\|/,
    );
    expect(source).toContain(
      'if (portfolioSyncRequest && !keepPortfolioSyncRequest)',
    );
    expect(source).not.toContain('<TokenSelectorLpTokenSwitch');
    expect(buttonSource).toContain('testID="home-sync-portfolio"');
    expect(buttonSource).toContain("state === 'loading'");
    expect(buttonSource).toContain("state === 'success'");
    expect(buttonSource).toContain(
      'ETranslations.portfolio_sync_to_device__action',
    );
    expect(buttonSource).toContain('accessibilityLiveRegion="polite"');
    expect(source).toContain('errorToastUtils.showToastOfError(error)');
    expect(source).toContain(
      'activePortfolioSyncRequest &&\n            activePortfolioSyncRequest.id === portfolioSyncRequest?.id',
    );
    expect(source).toContain('errorToastUtils.showToastOfError(e)');
    expect(source).toContain('pollingInterval: POLLING_INTERVAL_FOR_TOKEN');
  });

  it('replays the latest all-network snapshot without consuming another target request', () => {
    const source = readFileSync(join(__dirname, 'TokenListBlock.tsx'), 'utf8');
    const updateStart = source.indexOf(
      'const updateAllNetworksTokenList = useCallback',
    );
    const updateEnd = source.indexOf(
      'const runUpdateAllNetworksTokenList = useCallback',
      updateStart,
    );
    const updateSource = source.slice(updateStart, updateEnd);

    expect(source).toContain(
      'const allNetworksTokenListUpdatePendingRef = useRef(false);',
    );
    expect(updateStart).toBeGreaterThan(0);
    expect(updateEnd).toBeGreaterThan(updateStart);
    expect(updateSource).toMatch(
      /if \(allNetworksTokenListUpdateInFlightRef\.current\) \{\s+allNetworksTokenListUpdatePendingRef\.current = true;\s+return;/,
    );
    expect(updateSource).toMatch(
      /allNetworksTokenListUpdateInFlightRef\.current = false;\s+if \(allNetworksTokenListUpdatePendingRef\.current\) \{\s+allNetworksTokenListUpdatePendingRef\.current = false;\s+void updateAllNetworksTokenListRef\.current\(\);/,
    );
    expect(source).toContain(
      'updateAllNetworksTokenListRef.current = runUpdateAllNetworksTokenList',
    );
    expect(source).toMatch(
      /const runUpdateAllNetworksTokenList = useCallback\(async \(\) => \{\s+const portfolioSyncRequest =\s+getPortfolioSyncRequestForAllNetworksResult\(\);\s+try \{\s+await updateAllNetworksTokenList\(\);\s+\} catch \(error\) \{/,
    );
    expect(source).toContain('void runUpdateAllNetworksTokenList();');
    expect(updateSource).toContain(
      'getPortfolioSyncRequestForAllNetworksResult()',
    );
    expect(updateSource).toMatch(
      /const portfolioSyncRequest =\s+getPortfolioSyncRequestForAllNetworksResult\(\)/,
    );
    expect(updateSource).not.toContain('getCurrentPortfolioSyncRequest()');
    expect(source).toContain('minimumAllNetworksGeneration?: number;');
    expect(source).toContain(
      'allNetworksPublishedResultRef.current.generation + 1',
    );
    expect(source).toContain(
      'onResultPublished: handleAllNetworkResultPublished',
    );
    expect(source).toMatch(
      /publishedResult\.result !== allNetworksResult \|\|\s+publishedResult\.generation < request\.minimumAllNetworksGeneration/,
    );
    expect(source).toMatch(/currentRequest\?\.id === portfolioSyncRequest\.id/);
    expect(source).toContain('if (getCurrentPortfolioSyncRequest()) {');
    expect(source).not.toContain('if (portfolioSyncRequestRef.current) {');
  });

  it('keeps single-network Portfolio totals scoped to the active request and raw derive responses', () => {
    const source = readFileSync(join(__dirname, 'TokenListBlock.tsx'), 'utf8');
    const rawTotalIndex = source.indexOf('portfolioTotalFiat = resp');
    const mergeIndex = source.indexOf('getMergedDeriveTokenData({');
    const singleNetworkRunIndex = source.indexOf('const { run }');
    const captureRequestIndex = source.indexOf(
      'portfolioSyncRequest = getPortfolioSyncRequestForTarget(',
      singleNetworkRunIndex,
    );
    const missingAccountGuardIndex = source.indexOf(
      'if (!account) return;',
      singleNetworkRunIndex,
    );

    expect(source).toContain("let portfolioTotalFiat = '0';");
    expect(source).toContain(
      'let portfolioTotalFiatCurrency: string | undefined;',
    );
    expect(captureRequestIndex).toBeGreaterThan(singleNetworkRunIndex);
    expect(captureRequestIndex).toBeLessThan(missingAccountGuardIndex);
    expect(rawTotalIndex).toBeGreaterThan(0);
    expect(rawTotalIndex).toBeLessThan(mergeIndex);
    expect(source.slice(rawTotalIndex, mergeIndex)).toContain(
      'sumTokenGroupsFiatValueIgnoringUnavailable(item)',
    );
    expect(source).toContain(
      'activePortfolioSyncRequest?.id === portfolioSyncRequest.id',
    );
    expect(source).toContain('totalFiat: portfolioTotalFiat');
    expect(source).toContain(
      'portfolioTotalFiatCurrency = getWalletAssetStatusCurrency(resp);',
    );
    expect(source).toContain(
      'portfolioTotalFiatCurrency = getWalletAssetStatusCurrency([r]);',
    );
    expect(source).toContain('totalFiatCurrency: portfolioTotalFiatCurrency');
    expect(source).not.toContain('totalFiatCurrency: currencyInfo.id');
    expect(source).not.toContain(
      'totalFiat: sumTokenGroupsFiatValueIgnoringUnavailable(r)',
    );
  });

  it('commits the authoritative snapshot before running asset status analytics', () => {
    const source = readFileSync(join(__dirname, 'TokenListBlock.tsx'), 'utf8');
    const producerStart = source.indexOf(
      'const updateAllNetworksTokenList = useCallback',
    );
    const producerSource = source.slice(producerStart);
    const worthIndex = producerSource.indexOf('updateAccountWorth({');
    const commitIndex = producerSource.indexOf(
      'commitAuthoritativeIngest(snapshot);',
    );
    const readyStateIndex = producerSource.indexOf(
      'updateTokenListState({',
      commitIndex,
    );
    const analyticsIndex = producerSource.indexOf(
      'getWalletAssetStatusAnalytics',
      commitIndex,
    );

    expect(producerStart).toBeGreaterThan(0);
    expect(worthIndex).toBeGreaterThan(0);
    expect(commitIndex).toBeGreaterThan(worthIndex);
    expect(readyStateIndex).toBeGreaterThan(commitIndex);
    expect(analyticsIndex).toBeGreaterThan(readyStateIndex);
  });
});
