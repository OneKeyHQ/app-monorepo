import { readFileSync } from 'fs';
import { join } from 'path';

describe('TokenListBlock portfolio sync producer', () => {
  it('checks the Protocol V2 device type before building the cross-runtime payload', () => {
    const source = readFileSync(join(__dirname, 'TokenListBlock.tsx'), 'utf8');
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
    expect(source).toContain(
      'const interactivePortfolioSyncRequestedRef = useRef(false)',
    );
    expect(source).toContain(
      'interactivePortfolioSyncRequestedRef.current = true',
    );
    expect(source).toContain(
      'backgroundApiProxy.serviceHardwarePortfolioSync.syncPortfolio',
    );
    expect(source).toContain('const portfolioSyncPayload = {');
    expect(source).toContain('eventPayload: portfolioSyncPayload');
    expect(source).toContain("syncMode: 'interactive'");
    expect(source).toContain('const handleSyncPortfolio = useCallback(() => {');
    expect(source).toContain('testID="home-sync-portfolio"');
    expect(source).toContain('icon="RefreshCwOutline"');
    expect(source).toContain('pollingInterval: POLLING_INTERVAL_FOR_TOKEN');
  });
});
