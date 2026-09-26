import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

import { KeyringHardwareKeystone as KeyringHardwareKeystoneEvm } from './evm/KeyringHardwareKeystone';
import { KeyringHardwareKeystone as KeyringHardwareKeystoneSol } from './sol/KeyringHardwareKeystone';
import { KeyringHardwareKeystone as KeyringHardwareKeystoneTron } from './tron/KeyringHardwareKeystone';

type KeystoneAddressKeyring =
  | KeyringHardwareKeystoneEvm
  | KeyringHardwareKeystoneSol
  | KeyringHardwareKeystoneTron;

const cases = [
  ['evm', KeyringHardwareKeystoneEvm],
  ['sol', KeyringHardwareKeystoneSol],
  ['tron', KeyringHardwareKeystoneTron],
] as const;

describe.each(cases)('%s Keystone prepareAccounts', (network, Keyring) => {
  it('consumes the all-network response without loading the adapter', async () => {
    const getAllNetworkPrepareAccounts = jest.fn().mockResolvedValue({
      success: true,
      payload: [
        {
          address: 'device-address',
          path: "m/44'/0'/0'/0/0",
          publicKey: '',
          __hwExtraInfo__: { rootFingerprint: 123 },
        },
      ],
    });
    const keyring = Object.assign(Object.create(Keyring.prototype), {
      hwSdkNetwork: network,
      getAllNetworkPrepareAccounts,
      basePrepareHdNormalAccounts: async (
        _params: unknown,
        options: {
          buildAddressesInfo: (payload: {
            usedIndexes: number[];
          }) => Promise<unknown[]>;
        },
      ) => options.buildAddressesInfo({ usedIndexes: [0] }),
      vault: {
        validateAddress: jest.fn().mockResolvedValue({
          normalizedAddress: 'normalized-address',
        }),
      },
    }) as KeystoneAddressKeyring;

    const result = await keyring.prepareAccounts({
      indexes: [0],
      deriveInfo: {
        template: "m/44'/0'/0'/0/{index}",
      },
      hwAllNetworkPrepareAccountsResponse: {},
    } as never);

    expect(getAllNetworkPrepareAccounts).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        address: 'normalized-address',
        path: "m/44'/0'/0'/0/0",
      }),
    ]);
  });
});

describe('Keystone prepareAccounts all-network invariant', () => {
  it('does not fall back to a direct child-chain call when the response is missing', async () => {
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystoneEvm.prototype),
      {
        hwSdkNetwork: 'evm',
        getAllNetworkPrepareAccounts: jest.fn().mockResolvedValue(undefined),
        basePrepareHdNormalAccounts: async (
          _params: unknown,
          options: {
            buildAddressesInfo: (payload: {
              usedIndexes: number[];
            }) => Promise<unknown[]>;
          },
        ) => options.buildAddressesInfo({ usedIndexes: [0] }),
      },
    ) as KeyringHardwareKeystoneEvm;

    await expect(
      keyring.prepareAccounts({
        indexes: [0],
        deriveInfo: {
          template: "m/44'/60'/0'/0/{index}",
        },
      } as never),
    ).rejects.toThrow(
      'Keystone account preparation requires an all-network response',
    );
  });
});

describe('Keystone Solana message signing', () => {
  it('keeps unverified off-chain message signing disabled', async () => {
    const keyring = Object.create(
      KeyringHardwareKeystoneSol.prototype,
    ) as KeyringHardwareKeystoneSol;

    await expect(keyring.signMessage({} as never)).rejects.toBeInstanceOf(
      ThirdPartyMethodNotSupported,
    );
  });
});
