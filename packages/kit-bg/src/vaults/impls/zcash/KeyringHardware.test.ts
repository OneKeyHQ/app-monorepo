import { EDBAccountType } from '../../../dbs/local/consts';
import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { KeyringHardware } from './KeyringHardware';
import { zcashUserOperationsActive } from './vaultUtils';

import type { IEncodedTxZcash } from './types';

jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: { zec: { hd: {} } },
}));

const mockGetZcashApi = jest.fn<Promise<unknown>, []>();
jest.mock('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk', () => ({
  __esModule: true,
  default: { getZcashApi: (): Promise<unknown> => mockGetZcashApi() },
}));

function baseEncodedTx(): IEncodedTxZcash {
  return {
    zcashMode: 'privacy',
    zcashSpendSource: 'ironwood',
    inputs: [],
    outputs: [{ address: 'u1-recipient', value: '85000' }],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: '15000',
    txSize: 0,
    zcashTo: 'u1-recipient',
    zcashAmountValue: '85000',
    zcashTransparentPlan: {
      ownerId: 'owner',
      accountIndex: 0,
      sendMax: true,
      selectedOutpoints: [{ txid: '11'.repeat(32), vout: 0 }],
    },
  };
}

const deviceParams = {
  dbDevice: { connectId: 'connect-1', deviceId: 'device-1' },
  deviceCommonParams: { passphraseState: 'pp' },
};

function createSeedFingerprintStore(initial: Record<string, string> = {}) {
  const fingerprints = new Map(Object.entries(initial));
  return {
    getWalletSeedFingerprint: jest.fn(
      async ({ walletId }: { walletId: string }) => fingerprints.get(walletId),
    ),
    saveWalletSeedFingerprint: jest.fn(
      async ({
        walletId,
        seedFingerprintHex,
      }: {
        walletId: string;
        seedFingerprintHex: string;
      }) => {
        fingerprints.set(walletId, seedFingerprintHex);
      },
    ),
  };
}

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
    .mockResolvedValue({
      zcashGetAddress: jest.fn(),
      zcashSignPczt: jest.fn(),
      ...sdk,
    } as never);
  return Object.assign(Object.create(KeyringHardware.prototype), {
    vault: {
      accountId: 'hw-1--acc',
      zcashGetApi: mockGetZcashApi,
      zcashResolveLightwalletdUrl: async () => 'https://custom.lwd:443',
      zcashParseTransparentOutputs: async () => [],
      ...vault,
    },
    backgroundApi: {
      simpleDb: {
        zcash: {
          ...createSeedFingerprintStore(),
          ...simpleDbZcash,
        },
      },
      serviceAccount: {
        getDBAccountSafe: jest.fn().mockResolvedValue({ id: 'hw-1--acc' }),
        ...serviceAccount,
      },
    },
  }) as KeyringHardware;
}

// The device gets a redacted copy; tagging it shows which copy went where.
const redactPcztForHardwareSigner = async ({
  pcztHex,
}: {
  pcztHex: string;
}) => ({
  pcztHex: `${pcztHex}-device`,
});

describe('Zcash KeyringHardware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockGetZcashApi.mockReset();
  });

  it.each([0, 0x12_34_56_78, undefined])(
    'requires the device root fingerprint and preserves it on created accounts (%s)',
    async (rootFingerprint) => {
      const btcGetPublicKey = jest.fn().mockResolvedValue({
        success: true,
        payload: { root_fingerprint: rootFingerprint },
      });
      const zcashGetAddress = jest.fn().mockResolvedValue({
        success: true,
        payload: [0, 1].map(() => ({
          path: "m/32'/133'/0'",
          address: 'u1-account',
          ufvk: 'viewing-key',
          seedFingerprint: 'ab'.repeat(32),
        })),
      });
      const initializePrivacyModeOff = jest.fn();
      const keyring = createKeyring({
        sdk: { btcGetPublicKey, zcashGetAddress },
        simpleDbZcash: { initializePrivacyModeOff },
      });
      Object.assign(keyring, {
        walletId: 'hw-1',
        getCoreApiNetworkInfo: jest.fn().mockResolvedValue({
          networkChainCode: 'zec',
        }),
        getVaultSettings: jest.fn().mockResolvedValue({
          accountType: EDBAccountType.UTXO,
          impl: 'zec',
        }),
        coreApi: {
          getAddressFromXpub: jest.fn().mockResolvedValue({
            addresses: { '0/0': 't1-account' },
            publicKeys: { '0/0': 'public-key' },
          }),
        },
      });
      mockGetZcashApi.mockResolvedValue({
        deriveTransparentXpubFromUfvk: jest.fn().mockResolvedValue({
          xpub: 'transparent-xpub',
        }),
      });
      const result = keyring.prepareAccounts({
        indexes: [0, 1],
        deriveInfo: {
          template: "m/44'/133'/$$INDEX$$'/0/0",
          coinType: '133',
          namePrefix: 'ZEC',
        },
        deviceParams,
      } as Parameters<KeyringHardware['prepareAccounts']>[0]);
      if (rootFingerprint === undefined) {
        await expect(result).rejects.toThrow('valid root fingerprint');
        expect(zcashGetAddress).not.toHaveBeenCalled();
        expect(initializePrivacyModeOff).not.toHaveBeenCalled();
      } else {
        const accounts = await result;
        expect(accounts).toHaveLength(2);
        for (const account of accounts) {
          expect(account.__hwExtraInfo__).toEqual({ rootFingerprint });
        }
        expect(btcGetPublicKey).toHaveBeenCalledTimes(1);
        expect(btcGetPublicKey).toHaveBeenCalledWith(
          'connect-1',
          'device-1',
          expect.objectContaining({
            ...deviceParams.deviceCommonParams,
            path: "m/44'/1'/0'",
            showOnOneKey: false,
          }),
        );
      }
    },
  );

  it('signs the unproved PCZT on the device, then combines, proves and commits', async () => {
    const calls: string[] = [];
    const zcashSignPczt = jest.fn(async () => {
      calls.push('device');
      return { success: true, payload: { pczt: 'ccdd' } };
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
    mockGetZcashApi.mockResolvedValue({ redactPcztForHardwareSigner });
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
          ...baseEncodedTx(),
          zcashMode: 'privacy',
          pcztHex: 'aabb',
          pcztReservationId: 'res-1',
        },
      },
      deviceParams,
    } as never);

    expect(calls).toEqual(['assert', 'device', 'combine', 'prove', 'commit']);
    expect(zcashSignPczt).toHaveBeenCalledWith('connect-1', 'device-1', {
      passphraseState: 'pp',
      pczt: 'aabb-device',
    });
    expect(vault.zcashCombineSignedPczt).toHaveBeenCalledWith({
      accountId: 'hw-1--acc',
      originalPcztHex: 'aabb',
      signedPcztHex: 'ccdd',
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
            ...baseEncodedTx(),
            zcashMode: 'privacy',
            pcztHex: 'aabb',
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

  it.each([
    ['t1-recipient', false],
    ['t1-recipient', true],
    ['u1-recipient', false],
    ['u1-recipient', true],
  ])(
    'signs transparent funds to %s (max=%s) without privacy setup',
    async (address, sendMax) => {
      const request = {
        network: 'main',
        accountIndex: 0,
        targetHeight: 3_500_000,
        expiryHeight: 3_500_020,
        sendMax,
        recipients: [{ address }],
        selectedOutpoints: [{ txid: '11'.repeat(32), vout: 0 }],
      };
      const build = {
        rawTx: 'abcd',
        txid: '22'.repeat(32),
        feeZat: '15000',
        expiryHeight: request.expiryHeight,
        spentOutpoints: request.selectedOutpoints,
      };
      const sdk = {
        zcashGetAddress: jest.fn().mockResolvedValue({
          success: true,
          payload: [
            {
              path: "m/32'/133'/0'",
              address: 'u1-device',
              ufvk: 'viewing',
              seedFingerprint: '01'.repeat(32),
            },
          ],
        }),
        zcashSignPczt: jest.fn().mockResolvedValue({
          success: true,
          payload: { pczt: 'ccdd' },
        }),
      };
      const api = {
        deriveTransparentXpubFromUfvk: jest
          .fn()
          .mockResolvedValue({ xpub: 'account-xpub' }),
        createTransparentHardwarePczt: jest
          .fn()
          .mockResolvedValue({ pcztHex: 'aabb' }),
        finalizeTransparentHardwarePczt: jest.fn().mockResolvedValue(build),
        redactPcztForHardwareSigner,
      };
      mockGetZcashApi.mockResolvedValue(api);
      const simpleDbZcash = {
        reserveTransparentOutpoints: jest.fn(),
        saveTransparentPendingTx: jest.fn(),
        releaseTransparentReservation: jest.fn(),
        getAccountMeta: jest.fn(),
        isPrivacyModeEnabled: jest.fn().mockResolvedValue(false),
      };
      const keyring = createKeyring({
        sdk,
        simpleDbZcash,
        vault: {
          zcashPrepareFreshTransparentRequest: jest
            .fn()
            .mockResolvedValue(request),
        },
        serviceAccount: {
          getDBAccount: jest
            .fn()
            .mockResolvedValue({ pathIndex: 0, xpub: 'account-xpub' }),
        },
      });
      const result = await keyring.signTransaction({
        unsignedTx: {
          encodedTx: {
            ...baseEncodedTx(),
            zcashMode: 'transparent',
            fee: '15000',
            zcashTransparentPlan: {
              ...baseEncodedTx().zcashTransparentPlan,
              ownerId: 'owner',
            },
          },
        },
        deviceParams,
      } as never);
      expect(result.rawTx).toBe('abcd');
      expect(simpleDbZcash.getAccountMeta).not.toHaveBeenCalled();
      expect(simpleDbZcash.isPrivacyModeEnabled).not.toHaveBeenCalled();
      expect(api.finalizeTransparentHardwarePczt).toHaveBeenCalledWith({
        request,
        accountXpub: 'account-xpub',
        originalPcztHex: 'aabb',
        signedPcztHex: 'ccdd',
      });
      expect(simpleDbZcash.saveTransparentPendingTx).toHaveBeenCalledWith({
        accountId: 'hw-1--acc',
        requireLiveReservation: true,
        tx: expect.objectContaining({
          rawTx: 'abcd',
          broadcastAuthorized: false,
        }),
      });
      expect(
        simpleDbZcash.releaseTransparentReservation,
      ).not.toHaveBeenCalled();
      sdk.zcashSignPczt.mockResolvedValue({
        success: false,
        payload: { code: 800, error: 'Action cancelled by user' },
      });
      simpleDbZcash.saveTransparentPendingTx.mockClear();
      await expect(
        keyring.signTransaction({
          unsignedTx: {
            encodedTx: {
              ...baseEncodedTx(),
              zcashMode: 'transparent',
              fee: '15000',
              zcashTransparentPlan: {
                ...baseEncodedTx().zcashTransparentPlan,
                ownerId: 'owner',
              },
            },
          },
          deviceParams,
        } as never),
      ).rejects.toBeDefined();
      expect(simpleDbZcash.saveTransparentPendingTx).not.toHaveBeenCalled();
      expect(simpleDbZcash.releaseTransparentReservation).toHaveBeenCalledWith({
        accountId: 'hw-1--acc',
        ownerId: 'owner',
      });
    },
  );

  it('saves device-provided viewing metadata on privacy setup', async () => {
    const saveAccountMeta = jest.fn();
    const zcashGetAddress = jest.fn().mockResolvedValue({
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
    const deriveAddressFromUfvk = jest.fn().mockResolvedValue({
      unifiedAddress: 'u1app',
      transparentAddress: 't1account',
    });
    mockGetZcashApi.mockResolvedValue({
      deriveAddressFromUfvk,
      getChainTip: jest.fn().mockResolvedValue(3_000_000),
    });
    const keyring = createKeyring({
      sdk: { zcashGetAddress },
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

    // The configured node, not the build constant.
    expect(deriveAddressFromUfvk).toHaveBeenCalledWith(
      expect.objectContaining({ lightwalletdUrl: 'https://custom.lwd:443' }),
    );
    expect(zcashGetAddress).toHaveBeenCalledWith('connect-1', 'device-1', {
      passphraseState: 'pp',
      bundle: [
        {
          path: "m/32'/133'/2'",
          showOnOneKey: false,
          addressType: 2,
          scope: 0,
          diversifierIndex: 0,
          includeUfvk: true,
          includeSeedFingerprint: true,
        },
      ],
    });
    expect(saveAccountMeta).toHaveBeenCalledWith({
      accountId: 'hw-1--acc',
      expectedPrivacyModeState: { intent: 'on', birthdayHeight: 2_500_000 },
      meta: expect.objectContaining({
        ufvk: 'uview1device',
        unifiedAddress: 'u1device',
        // The device UA still includes a P2PKH receiver, so the app's
        // Orchard-only derivation is kept beside it.
        derivedUnifiedAddress: 'u1app',
        transparentAddress: 't1account',
        seedFingerprintHex: 'ab'.repeat(32),
        hdIndex: 2,
        birthdayHeight: 2_500_000,
        birthdaySource: 'manual-height',
      }),
    });
    // One seed per hardware wallet: the fingerprint is kept per wallet.
    await expect(
      (
        keyring as unknown as {
          backgroundApi: {
            simpleDb: {
              zcash: {
                getWalletSeedFingerprint: (p: {
                  walletId: string;
                }) => Promise<string | undefined>;
              };
            };
          };
        }
      ).backgroundApi.simpleDb.zcash.getWalletSeedFingerprint({
        walletId: 'hw-1',
      }),
    ).resolves.toBe('ab'.repeat(32));
  });

  it('refuses privacy setup on a device whose seed differs from the wallet', async () => {
    const saveAccountMeta = jest.fn();
    mockGetZcashApi.mockResolvedValue({
      deriveAddressFromUfvk: jest.fn().mockResolvedValue({
        unifiedAddress: 'u1app',
        transparentAddress: 't1account',
      }),
      getChainTip: jest.fn().mockResolvedValue(3_000_000),
    });
    const keyring = createKeyring({
      sdk: {
        zcashGetAddress: jest.fn().mockResolvedValue({
          success: true,
          payload: [
            {
              path: "m/32'/133'/2'",
              address: 'u1device',
              ufvk: 'uview1device',
              seedFingerprint: 'cd'.repeat(32),
            },
          ],
        }),
      },
      simpleDbZcash: {
        ...createSeedFingerprintStore({ 'hw-1': 'ab'.repeat(32) }),
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

    await expect(
      keyring.retryLocalWalletSetup({ deviceParams: deviceParams as never }),
    ).rejects.toThrow('device seed does not match this wallet');
    expect(saveAccountMeta).not.toHaveBeenCalled();
  });

  it('stops keeping a second string once the firmware address agrees', async () => {
    const saveAccountMeta = jest.fn();
    mockGetZcashApi.mockResolvedValue({
      deriveAddressFromUfvk: jest.fn().mockResolvedValue({
        unifiedAddress: 'u1device',
        transparentAddress: 't1account',
      }),
      getChainTip: jest.fn().mockResolvedValue(3_000_000),
    });
    const keyring = createKeyring({
      sdk: {
        zcashGetAddress: jest.fn().mockResolvedValue({
          success: true,
          payload: [
            {
              path: "m/32'/133'/2'",
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
          pathIndex: 2,
          address: 't1account',
        }),
      },
    });

    await keyring.retryLocalWalletSetup({
      deviceParams: deviceParams as never,
    });

    const [{ meta }] = saveAccountMeta.mock.calls[0] as [
      { meta: Record<string, unknown> },
    ];
    expect(meta.unifiedAddress).toBe('u1device');
    expect(meta.derivedUnifiedAddress).toBeUndefined();
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
        zcashGetAddress: jest.fn().mockResolvedValue({
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

// The transparent path carries four assertions that only fail on a device:
// account drift, a viewing key that is not this account's, a signed result
// that no longer matches what was reviewed, and an account removed mid-signing.
// Each of them must also let the input reservation go.
describe('Zcash KeyringHardware transparent signing', () => {
  const accountId = 'hw-1--acc';
  const request = {
    accountIndex: 0,
    network: 'main',
    selectedOutpoints: [{ txid: 'aa'.repeat(32), vout: 0 }],
    targetHeight: 2_000_000,
    expiryHeight: 2_000_040,
    recipients: [],
    sendMax: false,
  };
  const encodedTx = {
    fee: '10000',
    zcashMode: 'transparent',
    zcashTransparentPlan: { ownerId: 'owner-1' },
  };
  const buildResult = {
    feeZat: '10000',
    expiryHeight: request.expiryHeight,
    spentOutpoints: request.selectedOutpoints,
    rawTx: 'raw',
    txid: 'bb'.repeat(32),
  };

  afterEach(() => {
    jest.restoreAllMocks();
    mockGetZcashApi.mockReset();
  });

  function createTransparentKeyring({
    accountXpub = 'xpub-account',
    devicePubkeyXpub = 'xpub-account',
    pathIndex = 0,
    accountStillExists = true,
    result = buildResult,
    deviceResponse = { success: true, payload: { pczt: 'ccdd' } },
    storedFingerprint = undefined as string | undefined,
  } = {}) {
    const reserveTransparentOutpoints = jest.fn(async () => undefined);
    const releaseTransparentReservation = jest.fn(async () => undefined);
    const saveTransparentPendingTx = jest.fn(async () => undefined);
    const zcashSignPczt = jest.fn(async () => deviceResponse);
    const fingerprintStore = createSeedFingerprintStore(
      storedFingerprint ? { 'hw-1': storedFingerprint } : {},
    );
    const createTransparentHardwarePczt = jest.fn(async () => ({
      pcztHex: 'aabb',
    }));
    const finalizeTransparentHardwarePczt = jest.fn(async () => result);
    mockGetZcashApi.mockResolvedValue({
      deriveTransparentXpubFromUfvk: jest.fn(async () => ({
        xpub: devicePubkeyXpub,
      })),
      createTransparentHardwarePczt,
      finalizeTransparentHardwarePczt,
      redactPcztForHardwareSigner,
    });
    const keyring = createKeyring({
      sdk: { zcashSignPczt },
      vault: {
        accountId,
        zcashPrepareFreshTransparentRequest: jest.fn(async () => request),
      },
      simpleDbZcash: {
        ...fingerprintStore,
        reserveTransparentOutpoints,
        releaseTransparentReservation,
        saveTransparentPendingTx,
      },
      serviceAccount: {
        getDBAccount: jest.fn(async () => ({
          id: accountId,
          pathIndex,
          xpub: accountXpub,
        })),
        getDBAccountSafe: jest.fn(async () =>
          accountStillExists ? { id: accountId } : undefined,
        ),
      },
    });
    const fetchDeviceViewingKeys = jest
      .spyOn(
        keyring as unknown as {
          fetchDeviceViewingKeys: () => Promise<unknown>;
        },
        'fetchDeviceViewingKeys',
      )
      .mockResolvedValue([
        { ufvk: 'device-ufvk', seedFingerprint: 'EF'.repeat(32) },
      ]);
    const sign = () =>
      (
        keyring as unknown as {
          signTransparentTransaction: (params: {
            encodedTx: unknown;
            deviceParams: unknown;
          }) => Promise<{ txid: string; rawTx: string }>;
        }
      ).signTransparentTransaction({ encodedTx, deviceParams });
    return {
      sign,
      reserveTransparentOutpoints,
      releaseTransparentReservation,
      saveTransparentPendingTx,
      zcashSignPczt,
      fetchDeviceViewingKeys,
      createTransparentHardwarePczt,
      finalizeTransparentHardwarePczt,
      fingerprintStore,
    };
  }

  it('signs with the stored seed fingerprint and calls the device only to sign', async () => {
    const {
      sign,
      fetchDeviceViewingKeys,
      createTransparentHardwarePczt,
      finalizeTransparentHardwarePczt,
      zcashSignPczt,
    } = createTransparentKeyring({ storedFingerprint: 'ab'.repeat(32) });

    await expect(sign()).resolves.toMatchObject({ txid: buildResult.txid });

    expect(fetchDeviceViewingKeys).not.toHaveBeenCalled();
    expect(createTransparentHardwarePczt).toHaveBeenCalledWith({
      request,
      accountXpub: 'xpub-account',
      seedFingerprintHex: 'ab'.repeat(32),
    });
    expect(zcashSignPczt).toHaveBeenCalledTimes(1);
    expect(zcashSignPczt).toHaveBeenCalledWith(
      'connect-1',
      'device-1',
      expect.objectContaining({ pczt: 'aabb-device' }),
    );
    expect(finalizeTransparentHardwarePczt).toHaveBeenCalledWith(
      expect.objectContaining({
        originalPcztHex: 'aabb',
        signedPcztHex: 'ccdd',
      }),
    );
  });

  it('tracks the local proving step as a user operation, not the device wait', async () => {
    const { sign, finalizeTransparentHardwarePczt, zcashSignPczt } =
      createTransparentKeyring({ storedFingerprint: 'ab'.repeat(32) });
    const activeDuring: Record<string, boolean> = {};
    zcashSignPczt.mockImplementation(async () => {
      activeDuring.device = zcashUserOperationsActive();
      return { success: true, payload: { pczt: 'ccdd' } };
    });
    finalizeTransparentHardwarePczt.mockImplementation(async () => {
      activeDuring.finalize = zcashUserOperationsActive();
      return buildResult;
    });

    await expect(sign()).resolves.toMatchObject({ txid: buildResult.txid });

    expect(activeDuring).toEqual({ device: false, finalize: true });
    expect(zcashUserOperationsActive()).toBe(false);
  });

  it('asks the device once when no fingerprint is stored, then keeps it', async () => {
    const { sign, fetchDeviceViewingKeys, fingerprintStore } =
      createTransparentKeyring();

    await expect(sign()).resolves.toMatchObject({ txid: buildResult.txid });

    expect(fetchDeviceViewingKeys).toHaveBeenCalledTimes(1);
    expect(fingerprintStore.saveWalletSeedFingerprint).toHaveBeenCalledWith({
      walletId: 'hw-1',
      seedFingerprintHex: 'ef'.repeat(32),
    });
  });

  it('records the signed transaction as not yet authorized to broadcast', async () => {
    const { sign, saveTransparentPendingTx, releaseTransparentReservation } =
      createTransparentKeyring();

    await expect(sign()).resolves.toMatchObject({ txid: buildResult.txid });

    expect(saveTransparentPendingTx).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        requireLiveReservation: true,
        tx: expect.objectContaining({ broadcastAuthorized: false }),
      }),
    );
    expect(releaseTransparentReservation).not.toHaveBeenCalled();
  });

  it('refuses an account whose derivation no longer matches the request', async () => {
    const { sign, reserveTransparentOutpoints, zcashSignPczt } =
      createTransparentKeyring({ pathIndex: 7 });

    await expect(sign()).rejects.toThrow('hardware signing account changed');

    // Refused before anything was reserved, so there is nothing to release.
    expect(reserveTransparentOutpoints).not.toHaveBeenCalled();
    expect(zcashSignPczt).not.toHaveBeenCalled();
  });

  it('refuses a device viewing key that is not this account', async () => {
    const { sign, releaseTransparentReservation, zcashSignPczt } =
      createTransparentKeyring({ devicePubkeyXpub: 'xpub-someone-else' });

    await expect(sign()).rejects.toThrow(
      'device viewing key does not match this account',
    );

    expect(zcashSignPczt).not.toHaveBeenCalled();
    expect(releaseTransparentReservation).toHaveBeenCalledWith({
      accountId,
      ownerId: 'owner-1',
    });
  });

  it('refuses a signed result that differs from the reviewed transaction', async () => {
    const { sign, releaseTransparentReservation, saveTransparentPendingTx } =
      createTransparentKeyring({
        result: { ...buildResult, feeZat: '20000' },
      });

    await expect(sign()).rejects.toThrow(
      'did not match the reviewed transaction',
    );

    expect(saveTransparentPendingTx).not.toHaveBeenCalled();
    expect(releaseTransparentReservation).toHaveBeenCalledTimes(1);
  });

  it('refuses to record a transaction for an account removed while signing', async () => {
    const { sign, releaseTransparentReservation, saveTransparentPendingTx } =
      createTransparentKeyring({ accountStillExists: false });

    await expect(sign()).rejects.toThrow('account removed during signing');

    expect(saveTransparentPendingTx).not.toHaveBeenCalled();
    expect(releaseTransparentReservation).toHaveBeenCalledTimes(1);
  });

  it('releases the reservation when the device rejects the signature', async () => {
    const { sign, releaseTransparentReservation, saveTransparentPendingTx } =
      createTransparentKeyring({
        deviceResponse: {
          success: false,
          payload: { error: 'user cancelled', code: 1 },
        } as never,
      });

    await expect(sign()).rejects.toBeDefined();

    expect(saveTransparentPendingTx).not.toHaveBeenCalled();
    expect(releaseTransparentReservation).toHaveBeenCalledTimes(1);
  });
});
