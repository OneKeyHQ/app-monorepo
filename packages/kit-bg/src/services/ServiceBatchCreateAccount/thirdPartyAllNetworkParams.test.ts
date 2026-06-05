import {
  attachLedgerAllNetworkFingerprints,
  normalizeThirdPartyAllNetworkBundle,
} from './thirdPartyAllNetworkParams';

import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

describe('normalizeThirdPartyAllNetworkBundle', () => {
  it('normalizes EVM display and chain id params without dropping original fields', () => {
    const [item] = normalizeThirdPartyAllNetworkBundle([
      {
        network: 'evm',
        path: "m/44'/60'/0'/0/0",
        chainName: '1',
        showOnOneKey: true,
        group: 'default',
      },
    ]);

    expect(item).toEqual({
      network: 'evm',
      path: "m/44'/60'/0'/0/0",
      chainName: '1',
      showOnOneKey: true,
      showOnDevice: true,
      chainId: 1,
      methodName: 'evmGetAddress',
      group: 'default',
    });
  });

  it('normalizes BTC-family network names to the common BTC public-key method', () => {
    const items = normalizeThirdPartyAllNetworkBundle([
      { network: 'btc', path: "m/84'/0'/0'", showOnOneKey: false },
      { network: 'tbtc', path: "m/84'/1'/0'", showOnOneKey: false },
      { network: 'bch', path: "m/44'/145'/0'", showOnOneKey: false },
      { network: 'doge', path: "m/44'/3'/0'", showOnOneKey: false },
      { network: 'ltc', path: "m/84'/2'/0'", showOnOneKey: false },
      { network: 'neurai', path: "m/44'/1900'/0'", showOnOneKey: false },
    ]);

    expect(items.map((item) => item.methodName)).toEqual([
      'btcGetPublicKey',
      'btcGetPublicKey',
      'btcGetPublicKey',
      'btcGetPublicKey',
      'btcGetPublicKey',
      'btcGetPublicKey',
    ]);
    expect(
      items.some((item) => Object.prototype.hasOwnProperty.call(item, 'coin')),
    ).toBe(false);
    expect(items.every((item) => item.showOnDevice === false)).toBe(true);
  });

  it('normalizes SOL and TRON method names while preserving bundle shape', () => {
    const items = normalizeThirdPartyAllNetworkBundle([
      { network: 'sol', path: "m/44'/501'/0'/0'", showOnOneKey: true },
      { network: 'tron', path: "m/44'/195'/0'/0/0", showOnOneKey: false },
    ]);

    expect(items).toEqual([
      {
        network: 'sol',
        path: "m/44'/501'/0'/0'",
        showOnOneKey: true,
        showOnDevice: true,
        methodName: 'solGetAddress',
      },
      {
        network: 'tron',
        path: "m/44'/195'/0'/0/0",
        showOnOneKey: false,
        showOnDevice: false,
        methodName: 'tronGetAddress',
      },
    ]);
  });

  it('attaches Ledger chain fingerprints per all-network item', () => {
    const bundle: AllNetworkAddressParams[] = [
      { network: 'evm', path: "m/44'/60'/0'/0/0", showOnOneKey: false },
      { network: 'doge', path: "m/44'/3'/0'", showOnOneKey: false },
      { network: 'sol', path: "m/44'/501'/0'/0'", showOnOneKey: false },
      { network: 'tron', path: "m/44'/195'/0'/0/0", showOnOneKey: false },
    ];

    const result = attachLedgerAllNetworkFingerprints({
      bundle,
      settingsRaw: JSON.stringify({
        chainFingerprints: {
          evm: 'evm-fp',
          btc: 'btc-fp',
          sol: 'sol-fp',
          tron: 'tron-fp',
        },
      }),
    });

    expect(result).toBe(true);
    expect(
      bundle.map((item) => (item as { deviceId?: string }).deviceId),
    ).toEqual(['evm-fp', 'btc-fp', 'sol-fp', 'tron-fp']);
  });

  it('leaves Ledger all-network item fingerprint empty when it is missing', () => {
    const bundle: AllNetworkAddressParams[] = [
      { network: 'evm', path: "m/44'/60'/0'/0/0", showOnOneKey: false },
      { network: 'sol', path: "m/44'/501'/0'/0'", showOnOneKey: false },
    ];

    const result = attachLedgerAllNetworkFingerprints({
      bundle,
      settingsRaw: JSON.stringify({
        chainFingerprints: {
          evm: 'evm-fp',
        },
      }),
    });

    expect(result).toBe(true);
    expect((bundle[0] as { deviceId?: string }).deviceId).toBe('evm-fp');
    expect((bundle[1] as { deviceId?: string }).deviceId).toBeUndefined();
  });
});
