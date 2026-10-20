import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { collectKeystoneAccountKeys } from '../../vaults/base/keystoneAccountKeyUtils';

import ServiceBatchCreateAccount from './ServiceBatchCreateAccount';

import type { IDBDevice } from '../../dbs/local/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: { sdkLog: { consoleLog: jest.fn(), log: jest.fn() } },
    account: {
      batchCreatePerf: new Proxy({}, { get: () => jest.fn() }),
    },
  },
}));

const mockPinDeviceKeystoneAccountKeys = jest.fn<
  Promise<string[]>,
  [unknown]
>();
jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    pinDeviceKeystoneAccountKeys: (params: unknown) =>
      mockPinDeviceKeystoneAccountKeys(params),
  },
}));
const pinDeviceKeystoneAccountKeys = mockPinDeviceKeystoneAccountKeys;

const EVM_ACCOUNT_PATH = "m/44'/60'/0'";

function evmItem(index: number, publicKey?: string, xpub = `xpub-${index}`) {
  return {
    success: true,
    network: 'evm' as const,
    path: `${EVM_ACCOUNT_PATH}/0/${index}`,
    payload: {
      address: `0x${index}`,
      ...(publicKey
        ? {
            accountKey: {
              path: EVM_ACCOUNT_PATH,
              publicKey,
              chainCode: 'cc',
              xpub,
            },
          }
        : {}),
    },
  };
}

async function fetchKeystoneAddresses(items: unknown[]) {
  const dbDevice = {
    id: 'keystone-db-device',
    connectId: 'keystone-wallet:a1b2c3d4',
    deviceId: 'a1b2c3d4',
    vendor: EHardwareVendor.keystone,
    settingsRaw: '{}',
  } as IDBDevice;
  const service = new ServiceBatchCreateAccount({
    backgroundApi: { serviceThirdPartyHardware: {} },
  });
  return (
    service as unknown as {
      callThirdPartyAllNetworkGetAddress: (params: unknown) => Promise<unknown>;
    }
  ).callThirdPartyAllNetworkGetAddress({
    allNetworkGetAddress: jest
      .fn()
      .mockResolvedValue({ success: true, payload: items }),
    connectId: dbDevice.connectId,
    deviceId: dbDevice.deviceId,
    dbDeviceId: dbDevice.id,
    dbDevice,
    vendor: EHardwareVendor.keystone,
    createSceneParams: {},
    bundleParams: [],
    vendorName: 'Keystone',
  });
}

describe('Keystone account key pinning', () => {
  afterEach(() => {
    pinDeviceKeystoneAccountKeys.mockReset();
  });

  it('pins every account key it receives and returns the addresses', async () => {
    pinDeviceKeystoneAccountKeys.mockResolvedValue([]);
    // The same key encoded into two different xpub strings is still one key.
    const items = [
      evmItem(0, 'keyA', 'xpub-one'),
      evmItem(1, 'keyA', 'xpub-two'),
    ];

    await expect(fetchKeystoneAddresses(items)).resolves.toEqual(items);
    expect(pinDeviceKeystoneAccountKeys).toHaveBeenCalledWith({
      dbDeviceId: 'keystone-db-device',
      keys: { [`evm:${EVM_ACCOUNT_PATH}`]: 'keyA:cc' },
    });
  });

  it('pins the BTC account key returned with a public key', async () => {
    pinDeviceKeystoneAccountKeys.mockResolvedValue([]);
    const btcItem = {
      success: true,
      network: 'btc' as const,
      path: "m/84'/0'/0'",
      payload: {
        xpub: 'xpub-btc',
        accountKey: {
          path: "m/84'/0'/0'",
          publicKey: 'keyB',
          chainCode: 'cb',
          xpub: 'xpub-btc',
        },
      },
    };

    await fetchKeystoneAddresses([btcItem]);
    expect(pinDeviceKeystoneAccountKeys).toHaveBeenCalledWith({
      dbDeviceId: 'keystone-db-device',
      keys: { "btc:m/84'/0'/0'": 'keyB:cb' },
    });
  });

  it('refuses addresses from an account key other than the pinned one', async () => {
    pinDeviceKeystoneAccountKeys.mockResolvedValue([`evm:${EVM_ACCOUNT_PATH}`]);

    await expect(
      fetchKeystoneAddresses([evmItem(2, 'attackerKey')]),
    ).rejects.toMatchObject({ code: HardwareErrorCode.DeviceMismatch });
  });

  it('refuses a batch whose items disagree on one account key without pinning', async () => {
    await expect(
      fetchKeystoneAddresses([evmItem(0, 'keyA'), evmItem(1, 'keyB')]),
    ).rejects.toMatchObject({ code: HardwareErrorCode.DeviceMismatch });
    expect(pinDeviceKeystoneAccountKeys).not.toHaveBeenCalled();
  });

  it('pins nothing when the SDK does not report account keys', async () => {
    const items = [evmItem(0)];

    await expect(fetchKeystoneAddresses(items)).resolves.toEqual(items);
    expect(pinDeviceKeystoneAccountKeys).not.toHaveBeenCalled();
  });
});

describe('collectKeystoneAccountKeys', () => {
  it('ignores failed items and keys Solana entries by public key', () => {
    expect(
      collectKeystoneAccountKeys([
        { success: false, network: 'evm', path: 'x', payload: undefined },
        {
          success: true,
          network: 'sol',
          path: "m/44'/501'/0'/0'",
          payload: {
            accountKey: { path: "m/44'/501'/0'/0'", publicKey: 'pub' },
          },
        },
      ] as never),
    ).toEqual({ keys: { "sol:m/44'/501'/0'/0'": 'pub:' }, conflicting: [] });
  });
});
