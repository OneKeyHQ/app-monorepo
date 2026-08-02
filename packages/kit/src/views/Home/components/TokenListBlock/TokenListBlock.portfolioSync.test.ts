import { readFileSync } from 'fs';
import { join } from 'path';

describe('TokenListBlock portfolio sync producer', () => {
  it('checks the dev feature before building the cross-runtime payload', () => {
    const source = readFileSync(join(__dirname, 'TokenListBlock.tsx'), 'utf8');
    const gateIndex = source.indexOf('if (isPortfolioSyncDevEnabled)');
    const buildIndex = source.indexOf(
      'const flattenedAggregateTokenMap = flattenAggregateTokensMap',
    );
    const emitIndex = source.indexOf(
      'appEventBus.emit(EAppEventBusNames.AllNetworksTokenListSettled',
    );

    expect(source).toContain('useDevSettingsPersistAtom');
    expect(source).toContain(
      'deviceDbId: device?.id ?? wallet?.associatedDeviceInfo?.id',
    );
    expect(source).toMatch(
      /isPro2DebugModuleEnabled\(\s*devSettings,\s*'portfolio',?\s*\)/,
    );
    expect(gateIndex).toBeGreaterThan(0);
    expect(gateIndex).toBeLessThan(buildIndex);
    expect(buildIndex).toBeLessThan(emitIndex);
  });
});
