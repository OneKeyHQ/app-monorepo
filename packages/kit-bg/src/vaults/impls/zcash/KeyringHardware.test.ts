import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { KeyringHardware } from './KeyringHardware';

jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: { zec: { hd: {} } },
}));

const mockGetZcashApi = jest.fn<Promise<unknown>, []>();
jest.mock('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk', () => ({
  __esModule: true,
  default: { getZcashApi: (): Promise<unknown> => mockGetZcashApi() },
}));

const deviceParams = {
  dbDevice: { connectId: 'connect-1', deviceId: 'device-1' },
  deviceCommonParams: { passphraseState: 'pp' },
};

function createKeyring({
  sdk,
  vault,
  simpleDbZcash,
  serviceAccount,
}: {
  sdk: Record<string, jest.Mock>;
  vault?: Record<string, unknown>;
  simpleDbZcash?: Record<string, jest.Mock>;
  serviceAccount?: Record<string, jest.Mock>;
}) {
  jest
    .spyOn(KeyringHardwareBase.prototype, 'getHardwareSDKInstance')
    .mockResolvedValue(sdk as never);
  return Object.assign(Object.create(KeyringHardware.prototype), {
    vault: { accountId: 'hw-1--acc', ...vault },
    backgroundApi: {
      simpleDb: { zcash: simpleDbZcash ?? {} },
      serviceAccount: serviceAccount ?? {},
    },
  }) as KeyringHardware;
}

describe('Zcash KeyringHardware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockGetZcashApi.mockReset();
  });

  it('signs the unproved PCZT on the device, then combines, proves and commits', async () => {
    const calls: string[] = [];
    const zcashSignPczt = jest.fn(async () => {
      calls.push('device');
      return { success: true, payload: { pczt: 'signed-redacted' } };
    });
    const vault = {
      zcashAssertPcztReservationLive: jest.fn(async () => {
        calls.push('assert');
      }),
      zcashCombineSignedPczt: jest.fn(async () => {
        calls.push('combine');
        return { pcztHex: 'combined' };
      }),
      zcashProvePczt: jest.fn(async () => {
        calls.push('prove');
        return { pcztHex: 'proved' };
      }),
      zcashCommitSignedPczt: jest.fn(async () => {
        calls.push('commit');
      }),
      zcashAbandonPczt: jest.fn(),
    };
    const keyring = createKeyring({
      sdk: { zcashSignPczt },
      vault,
      simpleDbZcash: {
        getAccountMeta: jest.fn().mockResolvedValue({ ufvk: 'ufvk-1' }),
        isPrivacyModeEnabled: jest.fn().mockResolvedValue(true),
      },
    });

    const result = await keyring.signTransaction({
      unsignedTx: {
        encodedTx: {
          zcashMode: 'privacy',
          pcztHex: 'unproved',
          pcztReservationId: 'res-1',
        },
      },
      deviceParams,
    } as never);

    expect(calls).toEqual(['assert', 'device', 'combine', 'prove', 'commit']);
    expect(zcashSignPczt).toHaveBeenCalledWith('connect-1', 'device-1', {
      passphraseState: 'pp',
      pczt: 'unproved',
    });
    expect(vault.zcashCombineSignedPczt).toHaveBeenCalledWith({
      accountId: 'hw-1--acc',
      originalPcztHex: 'unproved',
      signedPcztHex: 'signed-redacted',
    });
    expect(vault.zcashProvePczt).toHaveBeenCalledWith({
      accountId: 'hw-1--acc',
      pcztHex: 'combined',
    });
    expect(result.rawTx).toBe('proved');
    expect((result.encodedTx as { signedPcztHex: string }).signedPcztHex).toBe(
      'proved',
    );
    expect(vault.zcashAbandonPczt).not.toHaveBeenCalled();
  });

  it('abandons the reservation when the device rejects', async () => {
    const vault = {
      zcashAssertPcztReservationLive: jest.fn(),
      zcashCombineSignedPczt: jest.fn(),
      zcashProvePczt: jest.fn(),
      zcashCommitSignedPczt: jest.fn(),
      zcashAbandonPczt: jest.fn(),
    };
    const keyring = createKeyring({
      sdk: {
        zcashSignPczt: jest.fn().mockResolvedValue({
          success: false,
          payload: { code: 800, error: 'Action cancelled by user' },
        }),
      },
      vault,
      simpleDbZcash: {
        getAccountMeta: jest.fn().mockResolvedValue({ ufvk: 'ufvk-1' }),
        isPrivacyModeEnabled: jest.fn().mockResolvedValue(true),
      },
    });

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx: {
            zcashMode: 'privacy',
            pcztHex: 'unproved',
            pcztReservationId: 'res-1',
          },
        },
        deviceParams,
      } as never),
    ).rejects.toBeDefined();

    expect(vault.zcashAbandonPczt).toHaveBeenCalledWith({
      accountId: 'hw-1--acc',
      reservationId: 'res-1',
    });
    expect(vault.zcashCombineSignedPczt).not.toHaveBeenCalled();
    expect(vault.zcashCommitSignedPczt).not.toHaveBeenCalled();
  });

  it('refuses transparent sends without touching the device', async () => {
    const zcashSignPczt = jest.fn();
    const keyring = createKeyring({ sdk: { zcashSignPczt } });

    await expect(
      keyring.signTransaction({
        unsignedTx: { encodedTx: { zcashMode: 'transparent' } },
        deviceParams,
      } as never),
    ).rejects.toThrow('not supported');
    expect(zcashSignPczt).not.toHaveBeenCalled();
  });

  it('saves device-provided viewing metadata on privacy setup', async () => {
    const saveAccountMeta = jest.fn();
    const zcashGetUnifiedAddress = jest.fn().mockResolvedValue({
      success: true,
      payload: [
        {
          path: "m/32'/133'/2'",
          address: 'u1device',
          ufvk: 'uview1device',
          seedFingerprint: 'ab'.repeat(32),
        },
      ],
    });
    mockGetZcashApi.mockResolvedValue({
      deriveAddressFromUfvk: jest.fn().mockResolvedValue({
        unifiedAddress: 'u1app',
        transparentAddress: 't1account',
      }),
      getChainTip: jest.fn().mockResolvedValue(3_000_000),
    });
    const keyring = createKeyring({
      sdk: { zcashGetUnifiedAddress },
      simpleDbZcash: {
        getPrivacyModeState: jest.fn().mockResolvedValue({
          intent: 'on',
          birthdayHeight: 2_500_000,
        }),
        getAccountMeta: jest.fn().mockResolvedValue(undefined),
        saveAccountMeta,
      },
      serviceAccount: {
        getDBAccount: jest.fn().mockResolvedValue({
          id: 'hw-1--acc',
          pathIndex: 2,
          address: 't1account',
        }),
      },
    });

    await keyring.retryLocalWalletSetup({
      deviceParams: deviceParams as never,
    });

    expect(zcashGetUnifiedAddress).toHaveBeenCalledWith(
      'connect-1',
      'device-1',
      {
        passphraseState: 'pp',
        bundle: [
          {
            path: "m/32'/133'/2'",
            showOnOneKey: false,
            includeUfvk: true,
            includeSeedFingerprint: true,
          },
        ],
      },
    );
    expect(saveAccountMeta).toHaveBeenCalledWith({
      accountId: 'hw-1--acc',
      meta: expect.objectContaining({
        ufvk: 'uview1device',
        unifiedAddress: 'u1device',
        transparentAddress: 't1account',
        seedFingerprintHex: 'ab'.repeat(32),
        hdIndex: 2,
        birthdayHeight: 2_500_000,
        birthdaySource: 'manual-height',
      }),
    });
  });

  it('rejects a device viewing key that does not match the account', async () => {
    const saveAccountMeta = jest.fn();
    mockGetZcashApi.mockResolvedValue({
      deriveAddressFromUfvk: jest.fn().mockResolvedValue({
        unifiedAddress: 'u1app',
        transparentAddress: 't1other',
      }),
      getChainTip: jest.fn().mockResolvedValue(3_000_000),
    });
    const keyring = createKeyring({
      sdk: {
        zcashGetUnifiedAddress: jest.fn().mockResolvedValue({
          success: true,
          payload: [
            {
              path: "m/32'/133'/0'",
              address: 'u1device',
              ufvk: 'uview1device',
              seedFingerprint: 'ab'.repeat(32),
            },
          ],
        }),
      },
      simpleDbZcash: {
        getPrivacyModeState: jest.fn().mockResolvedValue({
          intent: 'on',
          birthdayHeight: 2_500_000,
        }),
        getAccountMeta: jest.fn().mockResolvedValue(undefined),
        saveAccountMeta,
      },
      serviceAccount: {
        getDBAccount: jest.fn().mockResolvedValue({
          id: 'hw-1--acc',
          pathIndex: 0,
          address: 't1account',
        }),
      },
    });

    await expect(
      keyring.retryLocalWalletSetup({ deviceParams: deviceParams as never }),
    ).rejects.toThrow('does not match');
    expect(saveAccountMeta).not.toHaveBeenCalled();
  });
});
