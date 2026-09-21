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
    vault: { accountId: 'hw-1--acc', zcashGetApi: mockGetZcashApi, ...vault },
    backgroundApi: {
      simpleDb: { zcash: simpleDbZcash ?? {} },
      serviceAccount: {
        getDBAccountSafe: jest.fn().mockResolvedValue({ id: 'hw-1--acc' }),
        ...serviceAccount,
      },
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
          payload: { pczt: 'device-signed' },
        }),
      };
      const api = {
        deriveTransparentXpubFromUfvk: jest
          .fn()
          .mockResolvedValue({ xpub: 'account-xpub' }),
        createTransparentHardwarePczt: jest
          .fn()
          .mockResolvedValue({ pcztHex: 'original' }),
        finalizeTransparentHardwarePczt: jest.fn().mockResolvedValue(build),
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
            zcashMode: 'transparent',
            fee: '15000',
            zcashTransparentPlan: { ownerId: 'owner' },
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
        originalPcztHex: 'original',
        signedPcztHex: 'device-signed',
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
              zcashMode: 'transparent',
              fee: '15000',
              zcashTransparentPlan: { ownerId: 'owner' },
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
    mockGetZcashApi.mockResolvedValue({
      deriveAddressFromUfvk: jest.fn().mockResolvedValue({
        unifiedAddress: 'u1app',
        transparentAddress: 't1account',
      }),
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
        // The app's own derivation is kept beside the device's, so the
        // firmware's P2PKH drop (docs/05 D17) becomes checkable later.
        derivedUnifiedAddress: 'u1app',
        transparentAddress: 't1account',
        seedFingerprintHex: 'ab'.repeat(32),
        hdIndex: 2,
        birthdayHeight: 2_500_000,
        birthdaySource: 'manual-height',
      }),
    });
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
    deviceResponse = { success: true, payload: { pczt: 'signed' } },
  } = {}) {
    const reserveTransparentOutpoints = jest.fn(async () => undefined);
    const releaseTransparentReservation = jest.fn(async () => undefined);
    const saveTransparentPendingTx = jest.fn(async () => undefined);
    const zcashSignPczt = jest.fn(async () => deviceResponse);
    mockGetZcashApi.mockResolvedValue({
      deriveTransparentXpubFromUfvk: jest.fn(async () => ({
        xpub: devicePubkeyXpub,
      })),
      createTransparentHardwarePczt: jest.fn(async () => ({
        pcztHex: 'original',
      })),
      finalizeTransparentHardwarePczt: jest.fn(async () => result),
    });
    const keyring = createKeyring({
      sdk: { zcashSignPczt },
      vault: {
        accountId,
        zcashPrepareFreshTransparentRequest: jest.fn(async () => request),
      },
      simpleDbZcash: {
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
    jest
      .spyOn(
        keyring as unknown as {
          fetchDeviceViewingKeys: () => Promise<unknown>;
        },
        'fetchDeviceViewingKeys',
      )
      .mockResolvedValue([{ ufvk: 'device-ufvk', seedFingerprint: '00' }]);
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
    };
  }

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
