import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import { THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

import { thirdPartyCommonCallParamsForCreateScene } from '../../vaults/base/thirdPartyHardwareCommonParams';

import { normalizeAllNetworkInstallCancelErrors } from './thirdPartyAllNetworkErrors';
import {
  attachLedgerAllNetworkFingerprints,
  normalizeThirdPartyAllNetworkBundle,
} from './thirdPartyAllNetworkParams';

import type { IHwAllNetworkPrepareAccountsItem } from '../../vaults/types';
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

describe('normalizeAllNetworkInstallCancelErrors', () => {
  it('marks item install cancel separately when another item succeeded', () => {
    const result = normalizeAllNetworkInstallCancelErrors([
      {
        network: 'tron',
        path: "m/44'/195'/0'/0/0",
        success: false,
        payload: {
          code: ThirdPartyHwErrorCode.UserAborted,
          error: 'Action canceled',
          errorCode: ThirdPartyHwErrorCode.UserAborted,
          connectId: '',
          deviceId: '',
        },
      },
      {
        network: 'sol',
        path: "m/44'/501'/0'/0'",
        success: true,
        payload: {
          address: 'sol-address',
        },
      },
    ] as IHwAllNetworkPrepareAccountsItem[]);

    expect(result[0].payload?.code).toBe(
      THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
    );
  });

  it('keeps user cancel unchanged when no item succeeded', () => {
    const result = normalizeAllNetworkInstallCancelErrors([
      {
        network: 'tron',
        path: "m/44'/195'/0'/0/0",
        success: false,
        payload: {
          code: ThirdPartyHwErrorCode.UserAborted,
          error: 'Action canceled',
          errorCode: ThirdPartyHwErrorCode.UserAborted,
          connectId: '',
          deviceId: '',
        },
      },
      {
        network: 'sol',
        path: "m/44'/501'/0'/0'",
        success: false,
        payload: {
          code: ThirdPartyHwErrorCode.UserAborted,
          error: 'Action canceled',
          errorCode: ThirdPartyHwErrorCode.UserAborted,
          connectId: '',
          deviceId: '',
        },
      },
    ] as IHwAllNetworkPrepareAccountsItem[]);

    expect(result.map((item) => item.payload?.code)).toEqual([
      ThirdPartyHwErrorCode.UserAborted,
      ThirdPartyHwErrorCode.UserAborted,
    ]);
  });

  it('keeps user cancel unchanged for a single all-network item', () => {
    const result = normalizeAllNetworkInstallCancelErrors([
      {
        network: 'tron',
        path: "m/44'/195'/0'/0/0",
        success: false,
        payload: {
          code: ThirdPartyHwErrorCode.UserAborted,
          error: 'Action canceled',
          errorCode: ThirdPartyHwErrorCode.UserAborted,
          connectId: '',
          deviceId: '',
        },
      },
    ] as IHwAllNetworkPrepareAccountsItem[]);

    expect(result[0].payload?.code).toBe(ThirdPartyHwErrorCode.UserAborted);
  });
});

describe('thirdPartyCommonCallParamsForCreateScene', () => {
  it('keeps manual all-network calls on the SDK default install behavior', () => {
    expect(
      thirdPartyCommonCallParamsForCreateScene({
        isAutoCreateMultiNetwork: false,
      }),
    ).toBeUndefined();
  });
});
