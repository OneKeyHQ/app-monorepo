import { readFileSync } from 'fs';
import { join } from 'path';

describe('TokenListBlock portfolio sync producer', () => {
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
    expect(source).toContain('allowEmptyInteractivePortfolioSyncRef');
    expect(source).toContain(
      'if (portfolioSyncRequest && !skipPortfolioSyncRequestFinish)',
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
      'updateAllNetworksTokenListRef.current = updateAllNetworksTokenList',
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
    expect(
      updateSource.match(
        /getPortfolioSyncRequestForTarget\(\s+portfolioSyncTargetKey,/g,
      ),
    ).toHaveLength(2);
    expect(updateSource).not.toContain('getCurrentPortfolioSyncRequest()');
    expect(source).toContain('if (getCurrentPortfolioSyncRequest()) {');
    expect(source).not.toContain('if (portfolioSyncRequestRef.current) {');
  });

  it('keeps single-network Portfolio totals scoped to the active request and raw derive responses', () => {
    const source = readFileSync(join(__dirname, 'TokenListBlock.tsx'), 'utf8');
    const rawTotalIndex = source.indexOf('portfolioTotalFiat = resp');
    const mergeIndex = source.indexOf('getMergedDeriveTokenData({');

    expect(source).toContain("let portfolioTotalFiat = '0';");
    expect(rawTotalIndex).toBeGreaterThan(0);
    expect(rawTotalIndex).toBeLessThan(mergeIndex);
    expect(source.slice(rawTotalIndex, mergeIndex)).toContain(
      'sumTokenGroupsFiatValueIgnoringUnavailable(item)',
    );
    expect(source).toContain(
      'activePortfolioSyncRequest?.id === portfolioSyncRequest.id',
    );
    expect(source).toContain('totalFiat: portfolioTotalFiat');
    expect(source).not.toContain(
      'totalFiat: sumTokenGroupsFiatValueIgnoringUnavailable(r)',
    );
  });
});
