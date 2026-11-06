import addressFixtures from '@onekeyhq/core/src/chains/zcash/sdkZcash/unifiedAddress.fixtures.json';
import { ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET } from '@onekeyhq/shared/src/config/zcash';
import { createUntrackedMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import { EDBAccountType } from '../../../dbs/local/consts';
import { SimpleDbEntityPrivacyChainKeys } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';

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

// The device answers each requested address type: 1 transparent, 2 Orchard UA.
function deviceAddresses({
  transparent = 't1account',
  unified = 'u1device',
  seedFingerprint = 'ab'.repeat(32),
}: {
  transparent?: string;
  unified?: string;
  seedFingerprint?: string;
} = {}) {
  return jest.fn(
    async (
      _connectId: string,
      _deviceId: string,
      { bundle }: { bundle: { path: string; addressType: number }[] },
    ) => ({
      success: true,
      payload: bundle.map(({ path, addressType }) => ({
        path,
        address: addressType === 1 ? transparent : unified,
        seedFingerprint,
      })),
    }),
  );
}

function deviceViewingKey(ufvk = 'uview1device') {
  return jest.fn(async () => ({
    success: true,
    payload: { path: "m/32'/133'/0'", ufvk },
  }));
}

function receiveVerificationParams(
  form: 'public' | 'private',
  expectedAddress: string,
) {
  return {
    indexes: [2],
    deriveInfo: {
      template: "m/44'/133'/$$INDEX$$'/0/0",
      coinType: '133',
      namePrefix: 'ZEC',
    },
    deviceParams: {
      ...deviceParams,
      confirmOnDevice: EConfirmOnDeviceType.EveryItem,
    },
    chainExtraParams: {
      localWalletAddressForm: form,
      expectedAddress,
      receiveAddressPath: "m/44'/133'/2'/1/17",
    },
  } as Parameters<KeyringHardware['batchGetAddresses']>[0];
}

function createSeedFingerprintStore(initial: Record<string, string> = {}) {
  const fingerprints = new Map(Object.entries(initial));
  return {
    getZcashWalletSeedFingerprint: jest.fn(
      async ({ walletId }: { walletId: string }) => fingerprints.get(walletId),
    ),
    saveZcashWalletSeedFingerprint: jest.fn(
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

function createKeysStore() {
  const storage = createUntrackedMemoryStorage(null);
  const entity = new SimpleDbEntityPrivacyChainKeys();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: storage.getItem,
    setItem: storage.setItem,
  };
  return entity;
}

function createKeyring({
  sdk,
  vault,
  simpleDbZcash,
  journal,
  serviceAccount,
}: {
  sdk: Record<string, jest.Mock>;
  vault?: Record<string, unknown>;
  simpleDbZcash?: Record<string, jest.Mock>;
  journal?: Record<string, jest.Mock>;
  serviceAccount?: Record<string, jest.Mock>;
}) {
  jest
    .spyOn(KeyringHardwareBase.prototype, 'getHardwareSDKInstance')
    .mockResolvedValue({
      zcashGetAddress: jest.fn(),
      zcashGetFullViewingKey: jest.fn(),
      zcashSignPczt: jest.fn(),
      ...sdk,
    } as never);
  return Object.assign(Object.create(KeyringHardware.prototype), {
    hwSdkNetwork: 'btc',
    vault: {
      accountId: 'hw-1--acc',
      networkId: 'zec--0',
      zcashGetApi: mockGetZcashApi,
      zcashGetAccountUfvk: async () => 'ufvk-1',
      zcashResolveLightwalletdUrl: async () => 'https://custom.lwd:443',
      zcashParseTransparentOutputs: async () => [],
      zcashGetStoredUfvk: async () => undefined,
      ...vault,
    },
    backgroundApi: {
      serviceCustomRpc: {
        ensureLocalWalletRemoteConfigLoaded: async () => undefined,
      },
      simpleDb: {
        privacyChainState: {
          ...createSeedFingerprintStore(),
          getAccountVkFp: jest.fn(async () => undefined),
          getAccountEpoch: jest.fn(async () => undefined),
          ...simpleDbZcash,
        },
        privacyChainJournal: { ...journal },
        privacyChainKeys: createKeysStore(),
        privacyChainZcashSent: { recordZcashSent: jest.fn(async () => {}) },
      },
      serviceAccount: {
        getDBAccountSafe: jest.fn().mockResolvedValue({ id: 'hw-1--acc' }),
        ...serviceAccount,
      },
    },
  }) as KeyringHardware;
}

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

  it.each([
    {
      form: 'public',
      address: 't1-on-screen',
      addressType: 1,
      scope: 1,
      index: 17,
    },
    {
      form: 'private',
      address: addressFixtures.find(
        (item) => item.name === 'P2PKH and Orchard',
      )!.address,
      addressType: 0,
      scope: 0,
      index: 0,
    },
    {
      form: 'private',
      address: addressFixtures.find(
        (item) => item.name === 'fixed public mnemonic Orchard golden',
      )!.address,
      addressType: 2,
      scope: 0,
      index: 0,
    },
  ] as const)(
    'requests the address displayed on the receive page (type $addressType)',
    async ({ form, address, addressType, scope, index }) => {
      const zcashGetAddress = jest.fn().mockResolvedValue({
        success: true,
        payload: [{ path: "m/32'/133'/2'", address }],
      });
      const keyring = createKeyring({ sdk: { zcashGetAddress } });
      await expect(
        keyring.batchGetAddresses(receiveVerificationParams(form, address)),
      ).resolves.toEqual([expect.objectContaining({ address })]);
      expect(zcashGetAddress).toHaveBeenCalledWith('connect-1', 'device-1', {
        passphraseState: 'pp',
        bundle: [
          {
            path: "m/32'/133'/2'",
            addressType,
            scope,
            diversifierIndex: index,
            showOnOneKey: true,
          },
        ],
      });
    },
  );

  it.each(
    addressFixtures.filter((item) =>
      ['P2SH and Orchard', 'unknown receiver', 'checksum'].includes(item.name),
    ),
  )(
    'rejects an address the device cannot reproduce before requesting it: $name',
    async ({ address }) => {
      const zcashGetAddress = jest.fn();
      const keyring = createKeyring({ sdk: { zcashGetAddress } });
      await expect(
        keyring.batchGetAddresses(
          receiveVerificationParams('private', address),
        ),
      ).rejects.toThrow('unsupported address verification receivers');
      expect(zcashGetAddress).not.toHaveBeenCalled();
    },
  );

  function prepareFromAllNetwork({
    items,
    simpleDbZcash,
  }: {
    items: Record<string, unknown>[];
    simpleDbZcash: Record<string, jest.Mock>;
  }) {
    const zcashGetAddress = jest.fn();
    const zcashGetFullViewingKey = jest.fn();
    const getItem = jest.fn(async ({ path }: { path: string }) => ({
      success: true,
      path,
      network: 'btc',
      payload: items.find((item) => item.path === path),
    }));
    const getAddressFromXpub = jest.fn().mockResolvedValue({
      addresses: { '0/0': 't1-account' },
      publicKeys: { '0/0': 'public-key' },
    });
    const keyring = createKeyring({
      sdk: { zcashGetAddress, zcashGetFullViewingKey },
      simpleDbZcash,
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
      coreApi: { getAddressFromXpub },
    });
    const result = keyring.prepareAccounts({
      indexes: [0, 1],
      deriveInfo: {
        template: "m/44'/133'/$$INDEX$$'/0/0",
        coinType: '133',
        namePrefix: 'ZEC',
      },
      deviceParams,
      hwAllNetworkPrepareAccountsResponse: { getItem },
    } as unknown as Parameters<KeyringHardware['prepareAccounts']>[0]);
    return {
      result,
      getItem,
      getAddressFromXpub,
      zcashGetAddress,
      zcashGetFullViewingKey,
    };
  }

  it('creates accounts from the BTC public keys alone, without the viewing key', async () => {
    const beginZcashPrivacyModeEnable = jest.fn();
    const saveZcashAccountMeta = jest.fn();
    const fingerprintStore = createSeedFingerprintStore();
    const {
      result,
      getItem,
      getAddressFromXpub,
      zcashGetAddress,
      zcashGetFullViewingKey,
    } = prepareFromAllNetwork({
      items: [0, 1].map((index) => ({
        path: `m/44'/133'/${index}'`,
        xpub: `device-xpub-${index}`,
        rootFingerprint: 0x12_34_56_78,
      })),
      simpleDbZcash: {
        ...fingerprintStore,
        beginZcashPrivacyModeEnable,
        saveZcashAccountMeta,
      },
    });

    const accounts = await result;

    expect(getItem.mock.calls.map(([arg]) => arg)).toEqual([
      { path: "m/44'/133'/0'", hwSdkNetwork: 'btc', useTweak: undefined },
      { path: "m/44'/133'/1'", hwSdkNetwork: 'btc', useTweak: undefined },
    ]);
    for (const index of [0, 1]) {
      expect(getAddressFromXpub).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({ xpub: `device-xpub-${index}` }),
      );
    }
    expect(zcashGetAddress).not.toHaveBeenCalled();
    expect(zcashGetFullViewingKey).not.toHaveBeenCalled();
    expect(accounts).toHaveLength(2);
    for (const account of accounts) {
      expect(account.__hwExtraInfo__).toEqual({
        rootFingerprint: 0x12_34_56_78,
      });
    }
    expect(
      fingerprintStore.saveZcashWalletSeedFingerprint,
    ).not.toHaveBeenCalled();
    expect(beginZcashPrivacyModeEnable).not.toHaveBeenCalled();
    expect(saveZcashAccountMeta).not.toHaveBeenCalled();
  });

  // Pro 2's BTC coin table has no Zcash, so the coin must be named; the path alone means Zcash.
  it('asks the all-network BTC public-key call for the transparent account', async () => {
    const keyring = createKeyring({ sdk: {} });

    await expect(
      keyring.buildHwAllNetworkPrepareAccountsParams({
        path: "m/44'/133'/3'/0/0",
        template: "m/44'/133'/$$INDEX$$'/0/0",
        index: 3,
      }),
    ).resolves.toEqual({
      network: 'btc',
      chainName: 'btc',
      path: "m/44'/133'/3'",
      showOnOneKey: false,
    });
  });

  it('signs the unproved PCZT on the device, then combines and proves', async () => {
    const calls: string[] = [];
    const zcashSignPczt = jest.fn(async () => {
      calls.push('device');
      return { success: true, payload: { pczt: 'ccdd' } };
    });
    const verifyPcztReview = jest.fn(async () => {
      calls.push('verify');
    });
    const vault = {
      zcashCombineSignedPczt: jest.fn(async () => {
        calls.push('combine');
        return { pcztHex: 'combined' };
      }),
      zcashProvePczt: jest.fn(async () => {
        calls.push('prove');
        return { pcztHex: 'proved' };
      }),
    };
    mockGetZcashApi.mockResolvedValue({
      redactPcztForHardwareSigner,
      verifyPcztReview,
    });
    const keyring = createKeyring({
      sdk: { zcashSignPczt },
      vault,
      simpleDbZcash: {
        getZcashAccountMeta: jest
          .fn()
          .mockResolvedValue({ vkFp: 'a'.repeat(32) }),
        isZcashPrivacyModeEnabled: jest.fn().mockResolvedValue(true),
      },
    });

    const result = await keyring.signTransaction({
      unsignedTx: {
        encodedTx: {
          ...baseEncodedTx(),
          zcashMode: 'privacy',
          pcztHex: 'aabb',
        },
      },
      deviceParams,
    } as never);

    expect(calls).toEqual(['verify', 'device', 'combine', 'prove']);
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
  });

  it('does not combine or prove when the device rejects', async () => {
    const vault = {
      zcashCombineSignedPczt: jest.fn(),
      zcashProvePczt: jest.fn(),
    };
    mockGetZcashApi.mockResolvedValue({
      redactPcztForHardwareSigner,
      verifyPcztReview: jest.fn(),
    });
    const keyring = createKeyring({
      sdk: {
        zcashSignPczt: jest.fn().mockResolvedValue({
          success: false,
          payload: { code: 800, error: 'Action cancelled by user' },
        }),
      },
      vault,
      simpleDbZcash: {
        getZcashAccountMeta: jest
          .fn()
          .mockResolvedValue({ vkFp: 'a'.repeat(32) }),
        isZcashPrivacyModeEnabled: jest.fn().mockResolvedValue(true),
      },
    });

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx: {
            ...baseEncodedTx(),
            zcashMode: 'privacy',
            pcztHex: 'aabb',
          },
        },
        deviceParams,
      } as never),
    ).rejects.toBeDefined();

    expect(vault.zcashCombineSignedPczt).not.toHaveBeenCalled();
    expect(vault.zcashProvePczt).not.toHaveBeenCalled();
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
        zcashGetAddress: deviceAddresses({
          transparent: 't1-account',
          seedFingerprint: '01'.repeat(32),
        }),
        zcashGetFullViewingKey: deviceViewingKey('viewing'),
        zcashSignPczt: jest.fn().mockResolvedValue({
          success: true,
          payload: { pczt: 'ccdd' },
        }),
      };
      const api = {
        createTransparentHardwarePczt: jest
          .fn()
          .mockResolvedValue({ pcztHex: 'aabb' }),
        finalizeTransparentHardwarePczt: jest.fn().mockResolvedValue(build),
        redactPcztForHardwareSigner,
      };
      mockGetZcashApi.mockResolvedValue(api);
      const simpleDbZcash = {
        getZcashAccountMeta: jest.fn(),
        isZcashPrivacyModeEnabled: jest.fn().mockResolvedValue(false),
      };
      const journal = {
        reserveTransparentOutpoints: jest.fn(),
        saveTransparentPendingTx: jest.fn(),
        releaseTransparentReservation: jest.fn(),
      };
      const keyring = createKeyring({
        sdk,
        simpleDbZcash,
        journal,
        vault: {
          zcashPrepareFreshTransparentRequest: jest
            .fn()
            .mockResolvedValue(request),
        },
        serviceAccount: {
          getDBAccount: jest.fn().mockResolvedValue({
            pathIndex: 0,
            xpub: 'account-xpub',
            address: 't1-account',
          }),
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
      expect(simpleDbZcash.getZcashAccountMeta).not.toHaveBeenCalled();
      expect(simpleDbZcash.isZcashPrivacyModeEnabled).not.toHaveBeenCalled();
      // No privacy setup stored a UFVK, and sending never asks the device to export one.
      expect(sdk.zcashGetFullViewingKey).not.toHaveBeenCalled();
      expect(api.createTransparentHardwarePczt).toHaveBeenCalledWith({
        request,
        accountXpub: 'account-xpub',
        seedFingerprintHex: '01'.repeat(32),
        ufvk: undefined,
      });
      expect(api.finalizeTransparentHardwarePczt).toHaveBeenCalledWith({
        request,
        accountXpub: 'account-xpub',
        originalPcztHex: 'aabb',
        signedPcztHex: 'ccdd',
        ufvk: undefined,
      });
      expect(journal.saveTransparentPendingTx).toHaveBeenCalledWith({
        accountId: 'hw-1--acc',
        requireLiveReservation: true,
        tx: expect.objectContaining({
          rawTx: 'abcd',
          broadcastAuthorized: false,
        }),
      });
      expect(journal.releaseTransparentReservation).not.toHaveBeenCalled();
      sdk.zcashSignPczt.mockResolvedValue({
        success: false,
        payload: { code: 800, error: 'Action cancelled by user' },
      });
      journal.saveTransparentPendingTx.mockClear();
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
      expect(journal.saveTransparentPendingTx).not.toHaveBeenCalled();
      expect(journal.releaseTransparentReservation).toHaveBeenCalledWith({
        accountId: 'hw-1--acc',
        ownerId: 'owner',
      });
    },
  );

  it('saves and verifies device-provided viewing metadata without querying the node', async () => {
    const saveAccountMeta = jest.fn();
    const zcashGetAddress = deviceAddresses();
    const zcashGetFullViewingKey = deviceViewingKey();
    const deriveAddressFromUfvk = jest.fn().mockResolvedValue({
      unifiedAddress: 'u1app',
      transparentAddress: 't1account',
    });
    const getChainTip = jest.fn().mockResolvedValue(3_000_000);
    mockGetZcashApi.mockResolvedValue({ deriveAddressFromUfvk, getChainTip });
    const keyring = createKeyring({
      sdk: { zcashGetAddress, zcashGetFullViewingKey },
      simpleDbZcash: {
        getZcashPrivacyModeState: jest.fn().mockResolvedValue({
          intent: 'on',
          birthdayHeight: 2_500_000,
        }),
        getZcashAccountMeta: jest.fn().mockResolvedValue(undefined),
        saveZcashAccountMeta: saveAccountMeta,
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

    expect(deriveAddressFromUfvk).toHaveBeenCalledWith(
      expect.objectContaining({ lightwalletdUrl: 'https://custom.lwd:443' }),
    );
    expect(getChainTip).not.toHaveBeenCalled();
    const addressRequest = (addressType: number) => ({
      path: "m/32'/133'/2'",
      showOnOneKey: false,
      addressType,
      scope: 0,
      diversifierIndex: 0,
      includeSeedFingerprint: true,
    });
    expect(zcashGetAddress).toHaveBeenCalledWith('connect-1', 'device-1', {
      passphraseState: 'pp',
      bundle: [addressRequest(1), addressRequest(2)],
    });
    expect(zcashGetFullViewingKey).toHaveBeenCalledWith(
      'connect-1',
      'device-1',
      { passphraseState: 'pp', path: "m/32'/133'/2'" },
    );
    const vkFp = getViewingKeyFingerprint({
      networkId: 'zec--0',
      viewingKey: 'uview1device',
    });
    expect(saveAccountMeta).toHaveBeenCalledWith({
      accountId: 'hw-1--acc',
      expectedPrivacyModeState: { intent: 'on', birthdayHeight: 2_500_000 },
      meta: expect.objectContaining({
        vkFp,
        unifiedAddress: 'u1device',
        // The device UA still has a P2PKH receiver, so the Orchard-only derivation is kept beside it.
        derivedUnifiedAddress: 'u1app',
        transparentAddress: 't1account',
        seedFingerprintHex: 'ab'.repeat(32),
        hdIndex: 2,
        birthdayHeight: ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
        birthdaySource: 'manual-height',
      }),
    });
    expect(JSON.stringify(saveAccountMeta.mock.calls)).not.toContain(
      'uview1device',
    );
    await expect(
      (
        keyring as unknown as {
          backgroundApi: {
            simpleDb: { privacyChainKeys: SimpleDbEntityPrivacyChainKeys };
          };
        }
      ).backgroundApi.simpleDb.privacyChainKeys.getKey({
        accountId: 'hw-1--acc',
      }),
    ).resolves.toEqual({
      networkId: 'zec--0',
      vkFp,
      sealed: { format: 'plain', value: 'uview1device' },
    });
    await expect(
      (
        keyring as unknown as {
          backgroundApi: {
            simpleDb: {
              privacyChainState: {
                getZcashWalletSeedFingerprint: (p: {
                  walletId: string;
                }) => Promise<string | undefined>;
              };
            };
          };
        }
      ).backgroundApi.simpleDb.privacyChainState.getZcashWalletSeedFingerprint({
        walletId: 'hw-1',
      }),
    ).resolves.toBe('ab'.repeat(32));
  });

  it('refuses a device without this account before asking to export the viewing key', async () => {
    const saveAccountMeta = jest.fn();
    const zcashGetFullViewingKey = deviceViewingKey();
    const fingerprintStore = createSeedFingerprintStore();
    const keyring = createKeyring({
      sdk: {
        zcashGetAddress: deviceAddresses({ transparent: 't1other' }),
        zcashGetFullViewingKey,
      },
      simpleDbZcash: {
        ...fingerprintStore,
        getZcashPrivacyModeState: jest.fn().mockResolvedValue({
          intent: 'on',
          birthdayHeight: 2_500_000,
        }),
        getZcashAccountMeta: jest.fn().mockResolvedValue(undefined),
        saveZcashAccountMeta: saveAccountMeta,
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
    ).rejects.toThrow('device seed does not match this account');
    expect(zcashGetFullViewingKey).not.toHaveBeenCalled();
    expect(
      fingerprintStore.saveZcashWalletSeedFingerprint,
    ).not.toHaveBeenCalled();
    expect(saveAccountMeta).not.toHaveBeenCalled();
  });

  it('refuses privacy setup on a device whose seed differs from the wallet', async () => {
    const saveAccountMeta = jest.fn();
    const zcashGetFullViewingKey = deviceViewingKey();
    mockGetZcashApi.mockResolvedValue({
      deriveAddressFromUfvk: jest.fn().mockResolvedValue({
        unifiedAddress: 'u1app',
        transparentAddress: 't1account',
      }),
      getChainTip: jest.fn().mockResolvedValue(3_000_000),
    });
    const keyring = createKeyring({
      sdk: {
        zcashGetAddress: deviceAddresses({ seedFingerprint: 'cd'.repeat(32) }),
        zcashGetFullViewingKey,
      },
      simpleDbZcash: {
        ...createSeedFingerprintStore({ 'hw-1': 'ab'.repeat(32) }),
        getZcashPrivacyModeState: jest.fn().mockResolvedValue({
          intent: 'on',
          birthdayHeight: 2_500_000,
        }),
        getZcashAccountMeta: jest.fn().mockResolvedValue(undefined),
        saveZcashAccountMeta: saveAccountMeta,
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
    expect(zcashGetFullViewingKey).not.toHaveBeenCalled();
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
        zcashGetAddress: deviceAddresses(),
        zcashGetFullViewingKey: deviceViewingKey(),
      },
      simpleDbZcash: {
        getZcashPrivacyModeState: jest.fn().mockResolvedValue({
          intent: 'on',
          birthdayHeight: 2_500_000,
        }),
        getZcashAccountMeta: jest.fn().mockResolvedValue(undefined),
        saveZcashAccountMeta: saveAccountMeta,
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
        zcashGetAddress: deviceAddresses(),
        zcashGetFullViewingKey: deviceViewingKey(),
      },
      simpleDbZcash: {
        getZcashPrivacyModeState: jest.fn().mockResolvedValue({
          intent: 'on',
          birthdayHeight: 2_500_000,
        }),
        getZcashAccountMeta: jest.fn().mockResolvedValue(undefined),
        saveZcashAccountMeta: saveAccountMeta,
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
    deviceAccountAddress = 't1-account',
    pathIndex = 0,
    accountStillExists = true,
    result = buildResult,
    deviceResponse = { success: true, payload: { pczt: 'ccdd' } },
    storedFingerprint = undefined as string | undefined,
    storedUfvk = undefined as string | undefined,
    recipients = request.recipients as { address: string }[],
  } = {}) {
    const reserveTransparentOutpoints = jest.fn(async () => undefined);
    const releaseTransparentReservation = jest.fn(async () => undefined);
    const saveTransparentPendingTx = jest.fn(async () => undefined);
    const zcashSignPczt = jest.fn(async () => deviceResponse);
    const zcashGetAddress = deviceAddresses({
      transparent: deviceAccountAddress,
      seedFingerprint: 'EF'.repeat(32),
    });
    const zcashGetFullViewingKey = deviceViewingKey('device-ufvk');
    const fingerprintStore = createSeedFingerprintStore(
      storedFingerprint ? { 'hw-1': storedFingerprint } : {},
    );
    const createTransparentHardwarePczt = jest.fn(async () => ({
      pcztHex: 'aabb',
    }));
    const finalizeTransparentHardwarePczt = jest.fn(async () => result);
    mockGetZcashApi.mockResolvedValue({
      createTransparentHardwarePczt,
      finalizeTransparentHardwarePczt,
      redactPcztForHardwareSigner,
    });
    const keyring = createKeyring({
      sdk: { zcashSignPczt, zcashGetAddress, zcashGetFullViewingKey },
      vault: {
        accountId,
        zcashPrepareFreshTransparentRequest: jest.fn(async () => ({
          ...request,
          recipients,
        })),
        zcashGetStoredUfvk: jest.fn(async () => storedUfvk),
      },
      simpleDbZcash: { ...fingerprintStore },
      journal: {
        reserveTransparentOutpoints,
        releaseTransparentReservation,
        saveTransparentPendingTx,
      },
      serviceAccount: {
        getDBAccount: jest.fn(async () => ({
          id: accountId,
          pathIndex,
          xpub: 'xpub-account',
          address: 't1-account',
        })),
        getDBAccountSafe: jest.fn(async () =>
          accountStillExists ? { id: accountId } : undefined,
        ),
      },
    });
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
      zcashGetAddress,
      zcashGetFullViewingKey,
      createTransparentHardwarePczt,
      finalizeTransparentHardwarePczt,
      fingerprintStore,
    };
  }

  it('signs with the stored seed fingerprint and calls the device only to sign', async () => {
    const {
      sign,
      zcashGetAddress,
      zcashGetFullViewingKey,
      createTransparentHardwarePczt,
      finalizeTransparentHardwarePczt,
      zcashSignPczt,
    } = createTransparentKeyring({ storedFingerprint: 'ab'.repeat(32) });

    await expect(sign()).resolves.toMatchObject({ txid: buildResult.txid });

    expect(zcashGetAddress).not.toHaveBeenCalled();
    expect(zcashGetFullViewingKey).not.toHaveBeenCalled();
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

  it.each([
    ['stored', 'stored-ufvk'],
    ['missing', undefined],
  ])(
    'seals a shielded payment only with a stored UFVK, never exporting one (%s UFVK)',
    async (_label, storedUfvk) => {
      const shieldedRecipients = [{ address: 'u1-recipient' }];
      const {
        sign,
        zcashGetAddress,
        zcashGetFullViewingKey,
        createTransparentHardwarePczt,
        finalizeTransparentHardwarePczt,
      } = createTransparentKeyring({
        storedFingerprint: 'ef'.repeat(32),
        storedUfvk,
        recipients: shieldedRecipients,
      });

      await expect(sign()).resolves.toMatchObject({ txid: buildResult.txid });

      expect(zcashGetAddress).not.toHaveBeenCalled();
      expect(zcashGetFullViewingKey).not.toHaveBeenCalled();
      expect(createTransparentHardwarePczt).toHaveBeenCalledWith({
        request: { ...request, recipients: shieldedRecipients },
        accountXpub: 'xpub-account',
        seedFingerprintHex: 'ef'.repeat(32),
        ufvk: storedUfvk,
      });
      expect(finalizeTransparentHardwarePczt).toHaveBeenCalledWith(
        expect.objectContaining({ ufvk: storedUfvk }),
      );
    },
  );

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

  it('asks the device once without a prompt when no fingerprint is stored, then keeps it', async () => {
    const { sign, zcashGetAddress, zcashGetFullViewingKey, fingerprintStore } =
      createTransparentKeyring();

    await expect(sign()).resolves.toMatchObject({ txid: buildResult.txid });

    expect(zcashGetAddress).toHaveBeenCalledTimes(1);
    expect(zcashGetAddress).toHaveBeenCalledWith('connect-1', 'device-1', {
      passphraseState: 'pp',
      bundle: [
        {
          path: "m/32'/133'/0'",
          showOnOneKey: false,
          addressType: 1,
          scope: 0,
          diversifierIndex: 0,
          includeSeedFingerprint: true,
        },
      ],
    });
    expect(zcashGetFullViewingKey).not.toHaveBeenCalled();
    expect(
      fingerprintStore.saveZcashWalletSeedFingerprint,
    ).toHaveBeenCalledWith({
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

    expect(reserveTransparentOutpoints).not.toHaveBeenCalled();
    expect(zcashSignPczt).not.toHaveBeenCalled();
  });

  it('refuses a device that does not hold this account', async () => {
    const {
      sign,
      releaseTransparentReservation,
      zcashSignPczt,
      fingerprintStore,
    } = createTransparentKeyring({ deviceAccountAddress: 't1-someone-else' });

    await expect(sign()).rejects.toThrow(
      'device seed does not match this account',
    );

    expect(
      fingerprintStore.saveZcashWalletSeedFingerprint,
    ).not.toHaveBeenCalled();
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
