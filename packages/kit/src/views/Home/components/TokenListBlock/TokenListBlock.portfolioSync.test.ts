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

    expect(source).not.toContain('useDevSettingsPersistAtom');
    expect(source).toContain(
      'deviceDbId: device?.id ?? wallet.associatedDeviceInfo?.id',
    );
    expect(source).not.toContain('isPro2DebugModuleEnabled');
    expect(source).toContain(
      'accountUtils.isHwWallet({ walletId: wallet.id })',
    );
    expect(gateIndex).toBeGreaterThan(0);
    expect(gateIndex).toBeLessThan(buildIndex);
    expect(buildIndex).toBeLessThan(sendToBackgroundIndex);
    expect(source).not.toContain(
      'appEventBus.emit(EAppEventBusNames.AllNetworksTokenListSettled',
    );
  });
});
