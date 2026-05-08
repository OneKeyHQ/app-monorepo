import { AirGapEthSDK } from './AirGapEthSDK';

describe('AirGapEthSDK.normalizeGetMultiAccountsPath', () => {
  const sdk = new AirGapEthSDK();

  it('trims 5-segment Standard template down to EVM xpub depth (drops 2)', () => {
    expect(sdk.normalizeGetMultiAccountsPath("m/44'/60'/0'/0/0")).toBe(
      "m/44'/60'/0'",
    );
  });

  it('trims 5-segment LedgerLive template down to EVM xpub depth (drops 2)', () => {
    expect(sdk.normalizeGetMultiAccountsPath("m/44'/60'/3'/0/0")).toBe(
      "m/44'/60'/3'",
    );
  });

  it('trims 4-segment LedgerLegacy template down to EVM xpub depth (drops 1)', () => {
    expect(sdk.normalizeGetMultiAccountsPath("m/44'/60'/0'/7")).toBe(
      "m/44'/60'/0'",
    );
  });

  it('returns the path unchanged when already at target depth', () => {
    expect(sdk.normalizeGetMultiAccountsPath("m/44'/60'/0'")).toBe(
      "m/44'/60'/0'",
    );
  });

  it('returns the path unchanged when shallower than target depth', () => {
    expect(sdk.normalizeGetMultiAccountsPath("m/44'/60'")).toBe("m/44'/60'");
  });
});
