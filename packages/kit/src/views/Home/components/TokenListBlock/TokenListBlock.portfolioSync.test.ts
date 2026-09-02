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
      'isProtocolV2ProductType(device?.deviceType) &&',
    );
    const buildIndex = source.indexOf(
      'const flattenedAggregateTokenMap = flattenAggregateTokensMap',
    );
    const sendToBackgroundIndex = source.indexOf(
      'backgroundApiProxy.serviceHardwarePortfolioSync.notifyAllNetworksTokenListSettled',
    );
    const emptySnapshotGateIndex = source.indexOf(
      '!shouldDeferEmptyHardwarePortfolioSync({',
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
    expect(source).toContain("syncMode: 'interactive'");
    expect(source).toContain('const handleSyncPortfolio = useCallback(() => {');
    expect(source).toContain('<PortfolioSyncButton');
    expect(source).toContain('const showPortfolioSyncButton = Boolean(');
    expect(source).not.toContain('isWalletConnected(wallet)');
    expect(source).toContain(
      'device?.deviceType ?? wallet.associatedDeviceInfo?.deviceType',
    );
    expect(source).toContain('return renderPortfolioSyncButton();');
    expect(source).toContain('useFirmwareUpdateWorkflowRunningAtom');
    expect(source).toContain(
      'hardwareUiState || firmwareUpdateWorkflowRunning',
    );
    expect(source).toContain('completePortfolioSyncRequest');
    expect(source).toContain("setPortfolioSyncFeedback('success')");
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
});
