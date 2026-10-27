import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { KeyringHardware } from './KeyringHardware';

jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: { xmr: { hd: {} } },
}));

// cspell:ignore getwatchkey
// firmware-pro tests/device_tests/monero/test_getwatchkey.py, account 0.
const ADDRESS =
  '4Ahp23WfMrMFK3wYL2hLWQFGt87ZTeRkufS6JoQZu6MEFDokAQeGWmu9MA3GFq1yVLSJQbKJqVAn9F9DLYGpRzRAEXqAXKM';
const SPEND_PUBLIC_KEY =
  'efa28120860bbe558fa9f978dd254555566ba5a86974bae5c608f9a83822c955';
const WATCH_KEY =
  '8722520a581e2a50cc1adab4a1692401effd37b0d63b9d9b60fd7f34ea2b950e';

const deviceParams = {
  dbDevice: { connectId: 'connect-1', deviceId: 'device-1' },
  deviceCommonParams: { passphraseState: 'pp' },
};

function createKeyring({
  sdk,
  network = 'mainnet',
}: {
  sdk: Record<string, unknown>;
  network?: 'mainnet' | 'testnet';
}) {
  jest
    .spyOn(KeyringHardwareBase.prototype, 'getHardwareSDKInstance')
    .mockResolvedValue(sdk as never);
  return Object.assign(Object.create(KeyringHardware.prototype), {
    vault: {
      getXmrNetwork: async () => network,
      getAccount: async () => ({ path: "m/44'/128'/0'", address: ADDRESS }),
    },
  }) as KeyringHardware;
}

describe('Monero KeyringHardware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the viewing pair from the device for this account', async () => {
    const moneroGetWatchKey = jest.fn().mockResolvedValue({
      success: true,
      payload: { path: "m/44'/128'/0'", address: ADDRESS, watchKey: WATCH_KEY },
    });
    const keyring = createKeyring({
      sdk: { moneroGetAddress: jest.fn(), moneroGetWatchKey },
    });

    await expect(
      keyring.xmrGetViewingKeyFromDevice({ deviceParams } as never),
    ).resolves.toBe(`${SPEND_PUBLIC_KEY}:${WATCH_KEY}`);
    expect(moneroGetWatchKey).toHaveBeenCalledWith('connect-1', 'device-1', {
      passphraseState: 'pp',
      path: "m/44'/128'/0'",
      networkType: 0,
    });
  });

  it('refuses a device that does not hold this account', async () => {
    const keyring = createKeyring({
      sdk: {
        moneroGetAddress: jest.fn(),
        moneroGetWatchKey: jest.fn().mockResolvedValue({
          success: true,
          payload: {
            path: "m/44'/128'/0'",
            address: '4other',
            watchKey: WATCH_KEY,
          },
        }),
      },
    });

    await expect(
      keyring.xmrGetViewingKeyFromDevice({ deviceParams } as never),
    ).rejects.toThrow('xmr: device does not hold this account');
  });

  it('surfaces a device failure instead of saving anything', async () => {
    const keyring = createKeyring({
      sdk: {
        moneroGetAddress: jest.fn(),
        moneroGetWatchKey: jest.fn().mockResolvedValue({
          success: false,
          payload: { error: 'Action cancelled by user', code: 803 },
        }),
      },
    });

    await expect(
      keyring.xmrGetViewingKeyFromDevice({ deviceParams } as never),
    ).rejects.toThrow();
  });

  it('asks for an app update before touching a device on an SDK without Monero', async () => {
    const keyring = createKeyring({ sdk: {} });

    await expect(
      keyring.xmrGetViewingKeyFromDevice({ deviceParams } as never),
    ).rejects.toThrow('does not support Monero hardware accounts');
  });

  it('asks for one SEP-5 account path per index, on the testnet when the vault is', async () => {
    const moneroGetAddress = jest.fn().mockResolvedValue({
      success: true,
      payload: [
        { path: "m/44'/128'/0'", address: ADDRESS },
        { path: "m/44'/128'/1'", address: ADDRESS },
      ],
    });
    const keyring = createKeyring({
      sdk: { moneroGetAddress, moneroGetWatchKey: jest.fn() },
      network: 'testnet',
    });

    await keyring.batchGetAddresses({
      indexes: [0, 1],
      deriveInfo: {
        template: "m/44'/128'/$$INDEX$$'",
        coinType: '128',
        namePrefix: 'XMR',
      },
      deviceParams: {
        ...deviceParams,
        confirmOnDevice: EConfirmOnDeviceType.LastItem,
      },
    } as never);

    expect(moneroGetAddress).toHaveBeenCalledWith('connect-1', 'device-1', {
      passphraseState: 'pp',
      bundle: [
        { path: "m/44'/128'/0'", networkType: 1, showOnOneKey: false },
        { path: "m/44'/128'/1'", networkType: 1, showOnOneKey: true },
      ],
    });
  });
});
