// cspell:ignore clsag clsags subaddr rsig vinis randMult
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
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
  runtime = {},
}: {
  sdk: Record<string, unknown>;
  network?: 'mainnet' | 'testnet';
  runtime?: Record<string, unknown>;
}) {
  jest
    .spyOn(KeyringHardwareBase.prototype, 'getHardwareSDKInstance')
    .mockResolvedValue(sdk as never);
  return Object.assign(Object.create(KeyringHardware.prototype), {
    hwSdkNetwork: 'xmr',
    vault: {
      getXmrNetwork: async () => network,
      getAccount: async () => ({ path: "m/44'/128'/0'", address: ADDRESS }),
      getXmrRuntimeApi: async () => runtime,
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

  it('creates accounts from the all-network response, keeping its root fingerprint', async () => {
    const moneroGetAddress = jest.fn();
    const getItem = jest.fn().mockResolvedValue({
      success: true,
      path: "m/44'/128'/0'",
      payload: { address: ADDRESS, rootFingerprint: 0x12_34_56_78 },
    });
    const keyring = createKeyring({
      sdk: { moneroGetAddress, moneroGetWatchKey: jest.fn() },
    });
    Object.assign(keyring, {
      walletId: 'hw-1',
      getVaultSettings: jest.fn().mockResolvedValue({
        accountType: 'simple',
        impl: 'xmr',
      }),
    });

    const accounts = await keyring.prepareAccounts({
      indexes: [0],
      deriveInfo: {
        template: "m/44'/128'/$$INDEX$$'",
        coinType: '128',
        namePrefix: 'XMR',
      },
      deviceParams,
      hwAllNetworkPrepareAccountsResponse: { getItem },
    } as never);

    expect(getItem).toHaveBeenCalledWith({
      path: "m/44'/128'/0'",
      hwSdkNetwork: 'xmr',
      useTweak: undefined,
    });
    expect(moneroGetAddress).not.toHaveBeenCalled();
    expect(accounts).toEqual([
      expect.objectContaining({
        address: ADDRESS,
        path: "m/44'/128'/0'",
        pub: SPEND_PUBLIC_KEY,
        __hwExtraInfo__: { rootFingerprint: 0x12_34_56_78 },
      }),
    ]);
  });

  it('reports a path the device cannot derive as an unsupported address type', async () => {
    const failed = {
      success: false,
      path: "m/44'/128'/0'/0/0",
      payload: {
        error: 'Failure_DataError,Non-hardened paths unsupported on Ed25519',
        code: 0,
      },
    };
    const keyring = createKeyring({ sdk: {} });
    Object.assign(keyring, {
      walletId: 'hw-1',
      getVaultSettings: jest.fn().mockResolvedValue({
        accountType: 'simple',
        impl: 'xmr',
      }),
    });

    await expect(
      keyring.prepareAccounts({
        indexes: [0],
        deriveInfo: {
          template: "m/44'/128'/$$INDEX$$'/0/0",
          coinType: '128',
          namePrefix: 'XMR Cake',
        },
        deviceParams,
        hwAllNetworkPrepareAccountsResponse: {
          getItem: jest.fn().mockResolvedValue(failed),
          getFirstErrorItem: jest.fn().mockResolvedValue(failed),
        },
      } as never),
    ).rejects.toMatchObject({
      key: ETranslations.feedback_hardware_unsupported_current_address_type,
    });
  });

  it.each(['mainnet', 'testnet'] as const)(
    'asks the all-network call for the %s account path',
    async (network) => {
      const keyring = createKeyring({ sdk: {}, network });

      await expect(
        keyring.buildHwAllNetworkPrepareAccountsParams({
          path: "m/44'/128'/0'",
          template: "m/44'/128'/$$INDEX$$'",
          index: 0,
        }),
      ).resolves.toEqual({
        network: 'xmr',
        path: "m/44'/128'/0'",
        chainName: network,
        showOnOneKey: false,
      });
    },
  );

  describe('key image sync', () => {
    const encKey = new Uint8Array(32).fill(5);
    const transfer = {
      outputId: 3,
      outKey: 'aa'.repeat(32),
      txPubKey: 'bb'.repeat(32),
      additionalTxPubKey: 'cc'.repeat(32),
      internalOutputIndex: 1,
      subAddrMajor: 0,
      subAddrMinor: 4,
    };

    function sealed(plain: Uint8Array) {
      const iv = new Uint8Array(12).fill(9);
      return {
        iv: bufferUtils.bytesToHex(iv),
        blob: bufferUtils.bytesToHex(
          chacha20poly1305(encKey, iv).encrypt(plain),
        ),
      };
    }

    it('sends the transfers on the account path and opens what comes back', async () => {
      const plain = new Uint8Array(96).fill(0x11);
      const moneroKeyImageSync = jest.fn().mockResolvedValue({
        success: true,
        payload: {
          encKey: bufferUtils.bytesToHex(encKey),
          keyImages: [sealed(plain)],
        },
      });
      const keyring = createKeyring({
        sdk: {
          moneroGetAddress: jest.fn(),
          moneroGetWatchKey: jest.fn(),
          moneroKeyImageSync,
        },
      });

      await expect(
        keyring.xmrGetKeyImagesFromDevice({
          deviceParams,
          transfers: [transfer],
        } as never),
      ).resolves.toEqual([
        { keyImage: '11'.repeat(32), signature: '11'.repeat(64) },
      ]);
      expect(moneroKeyImageSync).toHaveBeenCalledWith('connect-1', 'device-1', {
        passphraseState: 'pp',
        path: "m/44'/128'/0'",
        networkType: 0,
        transfers: [
          {
            outKey: transfer.outKey,
            txPubKey: transfer.txPubKey,
            additionalTxPubKeys: [transfer.additionalTxPubKey],
            internalOutputIndex: 1,
            subAddrMajor: 0,
            subAddrMinor: 4,
          },
        ],
      });
    });

    it('asks for an app update on an SDK that cannot sync key images', async () => {
      const keyring = createKeyring({
        sdk: { moneroGetAddress: jest.fn(), moneroGetWatchKey: jest.fn() },
      });

      await expect(
        keyring.xmrGetKeyImagesFromDevice({
          deviceParams,
          transfers: [transfer],
        } as never),
      ).rejects.toThrow('cannot check Monero hardware spends');
    });

    it('surfaces a device refusal', async () => {
      const keyring = createKeyring({
        sdk: {
          moneroGetAddress: jest.fn(),
          moneroGetWatchKey: jest.fn(),
          moneroKeyImageSync: jest.fn().mockResolvedValue({
            success: false,
            payload: { error: 'Action cancelled by user', code: 803 },
          }),
        },
      });

      await expect(
        keyring.xmrGetKeyImagesFromDevice({
          deviceParams,
          transfers: [transfer],
        } as never),
      ).rejects.toThrow();
    });
  });

  describe('signing', () => {
    const change = {
      amount: '500000000000',
      addr: {
        spend_public_key: 'cc'.repeat(32),
        view_public_key: 'cd'.repeat(32),
      },
      is_subaddress: false,
      is_integrated: false,
    };
    const REAL_MASK = '22'.repeat(32);
    const plan = {
      version: 1,
      networkType: 0,
      tsxData: {
        version: 1,
        client_version: 3,
        hard_fork: 16,
        unlock_time: 0,
        num_inputs: 1,
        mixin: 15,
        fee: '30000000',
        account: 0,
        minor_indices: [0],
        outputs: [
          {
            amount: '1000000000000',
            addr: {
              spend_public_key: 'aa'.repeat(32),
              view_public_key: 'ab'.repeat(32),
            },
            is_subaddress: false,
            is_integrated: false,
          },
          change,
        ],
        change_dts: change,
        rsig_data: { rsig_type: 3, bp_version: 4, grouping: [2] },
        integrated_indices: [],
      },
      inputs: [
        {
          outputs: Array.from({ length: 16 }, (_, index) => ({
            idx: 9_000_000 + index,
            key: { dest: 'dd'.repeat(32), commitment: 'de'.repeat(32) },
          })),
          real_output: 3,
          real_out_tx_key: '11'.repeat(32),
          real_out_additional_tx_keys: [],
          real_output_in_tx_index: 1,
          amount: '1500030000000',
          rct: true,
          mask: REAL_MASK,
          subaddr_minor: 0,
        },
      ],
      expected: {
        keyImages: ['33'.repeat(32)],
        fee: '30000000',
        recipientAmount: '1000000000000',
        changeAmount: '500000000000',
      },
    };
    const encodedTx = {
      from: ADDRESS,
      to: '4recipient',
      amount: '1',
      amountAtomic: '1000000000000',
      feeAtomic: '30000000',
      changeAtomic: '500000000000',
      priority: 'normal',
      chainTip: 3_767_827,
      inputCount: 1,
      devicePlanJson: JSON.stringify(plan),
    };
    const openingKey = new Uint8Array(32).fill(3);
    const clsag = Uint8Array.from([16, ...new Array<number>(32 * 18).fill(9)]);

    // Index 0 of wallet2 compute_sealing_key, written out for the test.
    function sealForIndexZero(plain: Uint8Array, key: Uint8Array) {
      const derive = (domain: string) =>
        keccak256(
          keccak256(
            Uint8Array.from([
              ...key,
              ...Array.from(domain, (char) => char.charCodeAt(0)),
              ...new Array<number>(12 - domain.length).fill(0),
              0,
              0,
              0,
              0,
            ]),
          ),
        );
      return bufferUtils.bytesToHex(
        chacha20poly1305(
          derive('sig-key'),
          derive('sig-iv').subarray(0, 12),
        ).encrypt(plain),
      );
    }
    const SEALED = sealForIndexZero(clsag, openingKey);

    const SEALED_TX_KEYS = {
      salt: '11'.repeat(32),
      randMult: '12'.repeat(32),
      txEncKeys: 'ee'.repeat(76),
    };
    const parts = {
      origIndices: [0],
      vinis: [`02${'00'.repeat(20)}${'33'.repeat(32)}`],
      pseudoOuts: ['44'.repeat(32)],
      txOuts: ['0003'.padEnd(68, '5'), '0003'.padEnd(68, '6')],
      outPks: ['55'.repeat(64), '56'.repeat(64)],
      ecdhInfos: ['66'.repeat(8), '67'.repeat(8)],
      rsig: '77'.repeat(40),
      extra: `01${'88'.repeat(32)}`,
      txPrefixHash: '99'.repeat(32),
      fullMessageHash: 'a9'.repeat(32),
      rv: { txnFee: '30000000', message: '99'.repeat(32), rvType: 6 },
    };
    function signedPayload(overrides: Record<string, unknown> = {}) {
      return {
        success: true,
        payload: {
          ...parts,
          signatures: [SEALED],
          openingKey: bufferUtils.bytesToHex(openingKey),
          // For the sent record: must not reach the runtime.
          ...SEALED_TX_KEYS,
          ...overrides,
        },
      };
    }

    function createSigningKeyring({
      sign,
      network,
      verifyTransaction = jest.fn(async () => undefined),
    }: {
      sign?: jest.Mock;
      network?: 'mainnet' | 'testnet';
      verifyTransaction?: jest.Mock;
    } = {}) {
      const assembleDeviceTransaction = jest.fn(async () =>
        JSON.stringify({ txid: 'ab'.repeat(32), rawHex: '0200' }),
      );
      const moneroSignTransaction =
        sign ?? jest.fn().mockResolvedValue(signedPayload());
      const keyring = createKeyring({
        sdk: {
          moneroGetAddress: jest.fn(),
          moneroGetWatchKey: jest.fn(),
          moneroSignTransaction,
        },
        network,
        runtime: { assembleDeviceTransaction, verifyTransaction },
      });
      return {
        keyring,
        moneroSignTransaction,
        assembleDeviceTransaction,
        verifyTransaction,
      };
    }

    function signParams(tx: Record<string, unknown> = encodedTx) {
      return {
        unsignedTx: { encodedTx: tx },
        password: '',
        deviceParams,
      } as never;
    }

    it('signs on the device, opens the signatures and has the runtime assemble them', async () => {
      const { keyring, moneroSignTransaction, assembleDeviceTransaction } =
        createSigningKeyring();

      await expect(keyring.signTransaction(signParams())).resolves.toEqual({
        txid: 'ab'.repeat(32),
        rawTx: '0200',
        encodedTx,
        xmrSentTxKeys: {
          device: { ...SEALED_TX_KEYS, txPrefixHash: parts.txPrefixHash },
        },
      });

      expect(moneroSignTransaction).toHaveBeenCalledWith(
        'connect-1',
        'device-1',
        {
          passphraseState: 'pp',
          path: "m/44'/128'/0'",
          networkType: 0,
          tsxData: plan.tsxData,
          inputs: plan.inputs,
        },
      );
      expect(assembleDeviceTransaction).toHaveBeenCalledWith(
        encodedTx.devicePlanJson,
        stringUtils.stableStringify({
          ...parts,
          clsags: [bufferUtils.bytesToHex(clsag)],
        }),
      );
      expect(moneroSignTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        assembleDeviceTransaction.mock.invocationCallOrder[0],
      );
    });

    it('surfaces a device rejection and assembles nothing', async () => {
      const { keyring, assembleDeviceTransaction } = createSigningKeyring({
        sign: jest.fn().mockResolvedValue({
          success: false,
          payload: { error: 'Action cancelled by user', code: 803 },
        }),
      });

      await expect(keyring.signTransaction(signParams())).rejects.toThrow();
      expect(assembleDeviceTransaction).not.toHaveBeenCalled();
    });

    it('refuses signatures that do not open and assembles nothing', async () => {
      const { keyring, assembleDeviceTransaction } = createSigningKeyring({
        sign: jest
          .fn()
          .mockResolvedValue(signedPayload({ openingKey: '04'.repeat(32) })),
      });

      await expect(keyring.signTransaction(signParams())).rejects.toThrow(
        'signature from the device does not open',
      );
      expect(assembleDeviceTransaction).not.toHaveBeenCalled();
    });

    it('refuses a device reply without the sealed tx keys', async () => {
      const { keyring, assembleDeviceTransaction } = createSigningKeyring({
        sign: jest
          .fn()
          .mockResolvedValue(signedPayload({ txEncKeys: undefined })),
      });
      await expect(keyring.signTransaction(signParams())).rejects.toThrow(
        'malformed hardware signed transaction',
      );
      expect(assembleDeviceTransaction).not.toHaveBeenCalled();
    });

    it('refuses a device reply that does not answer the request', async () => {
      const { keyring, assembleDeviceTransaction } = createSigningKeyring({
        sign: jest.fn().mockResolvedValue(signedPayload({ origIndices: [1] })),
      });

      await expect(keyring.signTransaction(signParams())).rejects.toThrow(
        'malformed hardware signed transaction',
      );
      expect(assembleDeviceTransaction).not.toHaveBeenCalled();
    });

    it('asks for an app update on an SDK that cannot sign', async () => {
      const assembleDeviceTransaction = jest.fn();
      const keyring = createKeyring({
        sdk: { moneroGetAddress: jest.fn(), moneroGetWatchKey: jest.fn() },
        runtime: {
          assembleDeviceTransaction,
          verifyTransaction: jest.fn(async () => undefined),
        },
      });

      await expect(keyring.signTransaction(signParams())).rejects.toThrow(
        'cannot sign Monero hardware transactions',
      );
      expect(assembleDeviceTransaction).not.toHaveBeenCalled();
    });

    it('has the runtime check the plan against the review before reaching the device', async () => {
      const { keyring, moneroSignTransaction, verifyTransaction } =
        createSigningKeyring({ network: 'testnet' });

      await keyring.signTransaction(signParams());

      expect(verifyTransaction).toHaveBeenCalledWith(
        encodedTx.devicePlanJson,
        stringUtils.stableStringify({
          network: 'testnet',
          fromAddress: ADDRESS,
          toAddress: encodedTx.to,
          amountAtomic: encodedTx.amountAtomic,
          feeAtomic: encodedTx.feeAtomic,
          changeAtomic: encodedTx.changeAtomic,
          isMaxSend: false,
        }),
      );
      expect(verifyTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        moneroSignTransaction.mock.invocationCallOrder[0],
      );
    });

    it('refuses a plan the runtime rejects without reaching the device', async () => {
      const { keyring, moneroSignTransaction, assembleDeviceTransaction } =
        createSigningKeyring({
          verifyTransaction: jest
            .fn()
            .mockRejectedValue(new Error('review mismatch: toAddress')),
        });

      await expect(keyring.signTransaction(signParams())).rejects.toThrow(
        'review mismatch: toAddress',
      );
      expect(moneroSignTransaction).not.toHaveBeenCalled();
      expect(assembleDeviceTransaction).not.toHaveBeenCalled();
    });

    it('refuses a transaction built for software signing', async () => {
      const { keyring, moneroSignTransaction } = createSigningKeyring();
      const { devicePlanJson: _plan, ...rest } = encodedTx;

      await expect(
        keyring.signTransaction(signParams({ ...rest, signableHex: 'aabb' })),
      ).rejects.toThrow('not built for a hardware device');
      expect(moneroSignTransaction).not.toHaveBeenCalled();
    });

    it('logs neither the plan nor the signatures nor the opening key', async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
        (level) => jest.spyOn(console, level).mockImplementation(() => {}),
      );
      await createSigningKeyring().keyring.signTransaction(signParams());
      await createSigningKeyring({
        sign: jest
          .fn()
          .mockResolvedValue(signedPayload({ openingKey: '04'.repeat(32) })),
      })
        .keyring.signTransaction(signParams())
        .catch(() => undefined);

      const logged = spies
        .flatMap((spy) => spy.mock.calls)
        .map((args) => stringUtils.stableStringify(args))
        .join('\n');
      for (const secret of [
        REAL_MASK,
        SEALED,
        bufferUtils.bytesToHex(openingKey),
        bufferUtils.bytesToHex(clsag),
        SEALED_TX_KEYS.txEncKeys,
      ]) {
        expect(logged).not.toContain(secret);
      }
    });
  });
});
