import * as BitcoinJS from 'bitcoinjs-lib';
import { tapleafHash } from 'bitcoinjs-lib/src/payments/bip341';
import bitcoinMessage from 'bitcoinjs-message';

import {
  getBitcoinBip32,
  getBitcoinECPair,
  getBtcForkNetwork,
  initBitcoinEcc,
  tweakSigner,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  AddressNotSupportSignMethodError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyDeviceMismatch,
  ThirdPartyMethodNotSupported,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import { KeyringHardwareKeystone } from './KeyringHardwareKeystone';

import type { IDBUtxoAccount } from '../../../dbs/local/types';

describe('KeyringHardwareKeystone.prepareAccounts', () => {
  it('builds P2TR descriptors from the bundled root fingerprint without another device call', async () => {
    const walletId = 'ab'.repeat(32);
    const xpub =
      'xpub6CsXcwbJS7Go9ZmTiQjZF6dG6mhmTBEoKzxymQUwMsynCXEK' +
      'AMXrzh8oym3vehjorx16T7mGuqCRKkZ84Zfc7PKuKVkBcCLn46VZCUXPWTH';
    const btcGetMasterFingerprint = jest.fn().mockResolvedValue({
      success: true,
      payload: { masterFingerprint: 'aabbccdd' },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        walletId: 'hw-wallet-id',
        hwSdkNetwork: 'btc',
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              hw: { btcGetMasterFingerprint },
            }),
          },
        },
        getVaultSettings: jest.fn().mockResolvedValue({
          accountType: EDBAccountType.UTXO,
          impl: 'btc',
        }),
        getCoreApiNetworkInfo: jest.fn().mockResolvedValue({
          networkChainCode: 'btc',
        }),
        coreApi: {
          getAddressFromXpub: jest.fn().mockResolvedValue({
            addresses: { '0/0': 'bc1paddress' },
            publicKeys: { '0/0': '02'.padEnd(66, '0') },
            xpubSegwit: 'tr(bare-xpub)',
          }),
        },
      },
    ) as KeyringHardwareKeystone;

    const [account] = await keyring.prepareAccounts({
      indexes: [0],
      deriveInfo: {
        coinType: '0',
        template: "m/86'/0'/{index}'/0/0",
        namePrefix: 'BTC Taproot',
        addressEncoding: EAddressEncodings.P2TR,
      },
      deviceParams: {
        dbDevice: {
          connectId: `keystone-wallet:${walletId}`,
          deviceId: walletId,
        },
        deviceCommonParams: {
          operationId: 'hwk-keystone-interaction',
        },
      },
      hwAllNetworkPrepareAccountsResponse: {
        getItem: jest.fn().mockResolvedValue({
          success: true,
          network: 'btc',
          path: "m/86'/0'/0'",
          payload: { xpub, rootFingerprint: 0xaa_bb_cc_dd },
        }),
      },
    } as never);

    expect(btcGetMasterFingerprint).not.toHaveBeenCalled();
    const utxoAccount = account as IDBUtxoAccount;
    expect(utxoAccount.xpubSegwit).toContain('tr([aabbccdd/86');
    expect(utxoAccount.xpubSegwit).not.toContain(walletId);
  });

  it('rejects a 64-hex wallet id returned in the MFP field', async () => {
    const walletId = 'ab'.repeat(32);
    const btcGetMasterFingerprint = jest.fn().mockResolvedValue({
      success: true,
      payload: { masterFingerprint: walletId },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        walletId: 'hw-wallet-id',
        hwSdkNetwork: 'btc',
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              hw: {
                btcGetMasterFingerprint,
              },
            }),
          },
        },
        getVaultSettings: jest.fn().mockResolvedValue({
          accountType: EDBAccountType.UTXO,
          impl: 'btc',
        }),
        getCoreApiNetworkInfo: jest.fn().mockResolvedValue({
          networkChainCode: 'btc',
        }),
        coreApi: {
          getAddressFromXpub: jest.fn().mockResolvedValue({
            addresses: { '0/0': 'bc1paddress' },
            publicKeys: { '0/0': '02'.padEnd(66, '0') },
            xpubSegwit: 'tr(bare-xpub)',
          }),
        },
      },
    ) as KeyringHardwareKeystone;

    await expect(
      keyring.prepareAccounts({
        indexes: [0],
        deriveInfo: {
          coinType: '0',
          template: "m/86'/0'/{index}'/0/0",
          namePrefix: 'BTC Taproot',
          addressEncoding: EAddressEncodings.P2TR,
        },
        deviceParams: {
          dbDevice: {
            connectId: `keystone-wallet:${walletId}`,
            deviceId: walletId,
            vendor: 'keystone',
          },
          deviceCommonParams: {
            operationId: 'hwk-keystone-interaction',
          },
        },
        hwAllNetworkPrepareAccountsResponse: {
          getItem: jest.fn().mockResolvedValue({
            success: true,
            network: 'btc',
            path: "m/86'/0'/0'",
            payload: {
              xpub:
                'xpub6CsXcwbJS7Go9ZmTiQjZF6dG6mhmTBEoKzxymQUwMsynCXEK' +
                'AMXrzh8oym3vehjorx16T7mGuqCRKkZ84Zfc7PKuKVkBcCLn46VZCUXPWTH',
            },
          }),
        },
      } as never),
    ).rejects.toThrow('invalid BIP32 master fingerprint');
    expect(btcGetMasterFingerprint).toHaveBeenCalledWith(
      'hwk-keystone-interaction',
      walletId,
      { operationId: 'hwk-keystone-interaction', knownConnections: [] },
    );
  });
});

describe('KeyringHardwareKeystone.batchGetAddresses', () => {
  it('requires manual confirmation instead of claiming device address verification', async () => {
    const btcGetAddress = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        address: 'bc1qaccount2address',
        path: "m/84'/0'/1'/0/7",
      },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        hwSdkNetwork: 'btc',
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              hw: { btcGetAddress },
            }),
          },
        },
        getCoreApiNetworkInfo: jest.fn().mockResolvedValue({
          networkChainCode: 'btc',
        }),
      },
    ) as KeyringHardwareKeystone;

    const fullPath = "m/84'/0'/1'/0/7";
    await expect(
      keyring.batchGetAddresses({
        indexes: [1],
        deriveInfo: {
          coinType: '0',
          template: "m/84'/0'/{index}'/0/0",
          namePrefix: 'BTC Native SegWit',
        },
        deviceParams: {
          dbDevice: {
            connectId: 'keystone-wallet:test',
            deviceId: 'test',
          },
        },
        chainExtraParams: { receiveAddressPath: fullPath },
        isVerifyAddressAction: true,
      } as never),
    ).rejects.toThrow('manual derivation-path confirmation');
    expect(btcGetAddress).not.toHaveBeenCalled();
  });

  it('requires manual confirmation when verify has no exact path', async () => {
    const btcGetAddress = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        address: 'bc1qdefaultleafaddress',
        path: "m/84'/0'/0'/0/0",
      },
    });
    const allNetworkGetAddress = jest.fn();
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        hwSdkNetwork: 'btc',
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              hw: { btcGetAddress, allNetworkGetAddress },
            }),
          },
        },
        getCoreApiNetworkInfo: jest.fn().mockResolvedValue({
          networkChainCode: 'btc',
        }),
      },
    ) as KeyringHardwareKeystone;

    await expect(
      keyring.batchGetAddresses({
        indexes: [0],
        deriveInfo: {
          coinType: '0',
          template: "m/84'/0'/$$INDEX$$'/0/0",
          namePrefix: 'BTC Native SegWit',
        },
        deviceParams: {
          dbDevice: {
            connectId: 'keystone-wallet:test',
            deviceId: 'test',
          },
        },
        isVerifyAddressAction: true,
      } as never),
    ).rejects.toThrow('manual derivation-path confirmation');
    expect(btcGetAddress).not.toHaveBeenCalled();
    expect(allNetworkGetAddress).not.toHaveBeenCalled();
  });

  it('requires manual confirmation for a Taproot account', async () => {
    const btcGetAddress = jest.fn();
    const allNetworkGetAddress = jest.fn();
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        hwSdkNetwork: 'btc',
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              hw: { btcGetAddress, allNetworkGetAddress },
            }),
          },
        },
        getCoreApiNetworkInfo: jest.fn().mockResolvedValue({
          networkChainCode: 'btc',
        }),
      },
    ) as KeyringHardwareKeystone;

    await expect(
      keyring.batchGetAddresses({
        indexes: [0],
        deriveInfo: {
          coinType: '0',
          template: "m/86'/0'/{index}'/0/0",
          namePrefix: 'BTC Taproot',
          addressEncoding: EAddressEncodings.P2TR,
        },
        deviceParams: {
          dbDevice: {
            connectId: 'keystone-wallet:test',
            deviceId: 'test',
          },
        },
        isVerifyAddressAction: true,
      } as never),
    ).rejects.toThrow('manual derivation-path confirmation');
    expect(btcGetAddress).not.toHaveBeenCalled();
    expect(allNetworkGetAddress).not.toHaveBeenCalled();
  });

  it.each([
    ["m/84'/0'/0'/0/5", '0/5'],
    ["m/84'/0'/0'/1/3", '1/3'],
  ])(
    'derives %s from the matching xpub relative path',
    async (fullPath, relPath) => {
      const allNetworkGetAddress = jest.fn().mockResolvedValue({
        success: true,
        payload: [
          {
            success: true,
            payload: { xpub: 'account-xpub' },
          },
        ],
      });
      const getAddressFromXpub = jest
        .fn()
        .mockImplementation(({ relativePaths }: { relativePaths: string[] }) =>
          Promise.resolve({
            addresses: { [relativePaths[0]]: `address-${relativePaths[0]}` },
          }),
        );
      const keyring = Object.assign(
        Object.create(KeyringHardwareKeystone.prototype),
        {
          hwSdkNetwork: 'btc',
          backgroundApi: {
            serviceThirdPartyHardware: {
              getAdapterForVendor: jest.fn().mockResolvedValue({
                hw: { allNetworkGetAddress },
              }),
            },
          },
          getCoreApiNetworkInfo: jest.fn().mockResolvedValue({
            networkChainCode: 'btc',
          }),
          coreApi: { getAddressFromXpub },
        },
      ) as KeyringHardwareKeystone;

      const result = await keyring.batchGetAddresses({
        indexes: [0],
        deriveInfo: {
          coinType: '0',
          template: "m/84'/0'/{index}'/0/0",
          namePrefix: 'BTC Native SegWit',
        },
        deviceParams: {
          dbDevice: {
            connectId: 'keystone-wallet:test',
            deviceId: 'test',
          },
        },
        chainExtraParams: { receiveAddressPath: fullPath },
      } as never);

      expect(getAddressFromXpub).toHaveBeenCalledWith(
        expect.objectContaining({ relativePaths: [relPath] }),
      );
      expect(result).toEqual([
        { path: fullPath, address: `address-${relPath}` },
      ]);
    },
  );
});

describe('KeyringHardwareKeystone signing', () => {
  const publicKeyHex =
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  const btcNetwork = getBtcForkNetwork('btc');
  initBitcoinEcc();
  const accountAddress = BitcoinJS.payments.p2wpkh({
    pubkey: Buffer.from(publicKeyHex, 'hex'),
    network: btcNetwork,
  }).address!;
  const taprootAccountAddress = BitcoinJS.payments.p2tr({
    internalPubkey: Buffer.from(publicKeyHex, 'hex').subarray(1, 33),
    network: btcNetwork,
  }).address!;
  const recipientAddress = BitcoinJS.payments.p2wpkh({
    pubkey: Buffer.from(
      '02c6047f9441ed7d6d3045406e95c07cd85a6c7e54a0b15a2a1bb7f8f7e8f4b3f6',
      'hex',
    ),
    network: btcNetwork,
  }).address!;
  const signingKey = Buffer.from('01'.padStart(64, '0'), 'hex');
  const signer = getBitcoinECPair().fromPrivateKey(signingKey);
  const taprootSigner = tweakSigner(
    signingKey,
    Buffer.from(publicKeyHex, 'hex'),
  );
  const accountPath = "m/84'/0'/0'";
  const fullPath = `${accountPath}/0/0`;

  function buildSigningKeyring({
    btcSignPsbt,
    btcGetMasterFingerprint,
    addressEncoding = EAddressEncodings.P2WPKH,
    signingAccountAddress = accountAddress,
    signingAccountPath = accountPath,
  }: {
    btcSignPsbt: jest.Mock;
    btcGetMasterFingerprint: jest.Mock;
    addressEncoding?: EAddressEncodings;
    signingAccountAddress?: string;
    signingAccountPath?: string;
  }) {
    const signingFullPath = `${signingAccountPath}/0/0`;
    const dbAccount = {
      id: 'account-1',
      path: signingAccountPath,
      relPath: '0/0',
      template: `${signingAccountPath}/0/0`,
      address: signingAccountAddress,
      pub: publicKeyHex,
      xpub: 'account-xpub',
    } as IDBUtxoAccount;
    const getAdapterForVendor = jest.fn().mockResolvedValue({
      hw: { btcSignPsbt, btcGetMasterFingerprint },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        walletId: 'hw-wallet-id',
        networkId: 'btc--0',
        backgroundApi: {
          serviceThirdPartyHardware: { getAdapterForVendor },
          serviceNetwork: {
            getDeriveTypeByTemplate: jest.fn().mockResolvedValue({
              deriveInfo: { addressEncoding },
            }),
          },
        },
        vault: {
          getAccount: jest.fn().mockResolvedValue(dbAccount),
          prepareBtcSignExtraInfo: jest.fn().mockResolvedValue({
            btcExtraInfo: {
              inputAddressesEncodings: [addressEncoding],
              nonWitnessPrevTxs: {},
              addressToPath: {
                [signingAccountAddress]: {
                  address: signingAccountAddress,
                  relPath: '0/0',
                  fullPath: signingFullPath,
                },
              },
              pathToAddresses: {},
            },
          }),
        },
        getCoreApiNetworkInfo: jest.fn().mockResolvedValue({
          networkChainCode: 'btc',
        }),
        coreApi: {
          getAddressFromXpub: jest.fn().mockResolvedValue({
            publicKeys: { '0/0': publicKeyHex },
          }),
        },
      },
    ) as KeyringHardwareKeystone;
    return { keyring, getAdapterForVendor, signingFullPath };
  }

  it('converts a normal native-SegWit send to a PSBT with device derivation data', async () => {
    let submittedPsbtHex = '';
    const btcSignPsbt = jest
      .fn()
      .mockImplementation(
        async (
          _connectId: string,
          _deviceId: string,
          request: { psbt: string },
        ) => {
          submittedPsbtHex = request.psbt;
          const signed = BitcoinJS.Psbt.fromHex(request.psbt, {
            network: btcNetwork,
          });
          signed.signInput(0, signer);
          return {
            success: true,
            payload: { signedPsbt: signed.toHex() },
          };
        },
      );
    const btcGetMasterFingerprint = jest.fn().mockResolvedValue({
      success: true,
      payload: { masterFingerprint: 'aabbccdd' },
    });
    const { keyring } = buildSigningKeyring({
      btcSignPsbt,
      btcGetMasterFingerprint,
    });

    await keyring.signTransaction({
      unsignedTx: {
        encodedTx: {
          inputs: [
            {
              txid: '00'.repeat(32),
              vout: 0,
              value: '10000',
              address: accountAddress,
              path: fullPath,
            },
          ],
          outputs: [
            {
              address: recipientAddress,
              value: '9000',
            },
          ],
        },
      },
      signOnly: true,
      deviceParams: {
        dbDevice: {
          id: 'device-1',
          connectId: 'keystone-wallet:test',
          deviceId: 'wallet-id',
        },
      },
    } as never);

    const submittedPsbt = BitcoinJS.Psbt.fromHex(submittedPsbtHex, {
      network: btcNetwork,
    });
    expect(submittedPsbt.data.inputs[0].bip32Derivation).toEqual([
      expect.objectContaining({
        masterFingerprint: Buffer.from('aabbccdd', 'hex'),
        pubkey: Buffer.from(publicKeyHex, 'hex'),
        path: fullPath,
      }),
    ]);
    expect(btcSignPsbt).toHaveBeenCalledTimes(1);
  });

  it('converts a normal Taproot send with taproot derivation data', async () => {
    let submittedPsbtHex = '';
    const btcSignPsbt = jest
      .fn()
      .mockImplementation(
        async (
          _connectId: string,
          _deviceId: string,
          request: { psbt: string },
        ) => {
          submittedPsbtHex = request.psbt;
          const signed = BitcoinJS.Psbt.fromHex(request.psbt, {
            network: btcNetwork,
          });
          signed.signInput(0, taprootSigner);
          return {
            success: true,
            payload: { signedPsbt: signed.toHex() },
          };
        },
      );
    const btcGetMasterFingerprint = jest.fn().mockResolvedValue({
      success: true,
      payload: { masterFingerprint: 'aabbccdd' },
    });
    const taprootAccountPath = "m/86'/0'/0'";
    const { keyring, signingFullPath } = buildSigningKeyring({
      btcSignPsbt,
      btcGetMasterFingerprint,
      addressEncoding: EAddressEncodings.P2TR,
      signingAccountAddress: taprootAccountAddress,
      signingAccountPath: taprootAccountPath,
    });

    await keyring.signTransaction({
      unsignedTx: {
        encodedTx: {
          inputs: [
            {
              txid: '00'.repeat(32),
              vout: 0,
              value: '10000',
              address: taprootAccountAddress,
              path: signingFullPath,
            },
          ],
          outputs: [{ address: recipientAddress, value: '9000' }],
        },
      },
      signOnly: true,
      deviceParams: {
        dbDevice: {
          id: 'device-1',
          connectId: 'keystone-wallet:test',
          deviceId: 'wallet-id',
        },
      },
    } as never);

    const submittedPsbt = BitcoinJS.Psbt.fromHex(submittedPsbtHex, {
      network: btcNetwork,
    });
    expect(submittedPsbt.data.inputs[0].tapBip32Derivation).toEqual([
      expect.objectContaining({
        masterFingerprint: Buffer.from('aabbccdd', 'hex'),
        pubkey: Buffer.from(publicKeyHex, 'hex').subarray(1, 33),
        path: signingFullPath,
        leafHashes: [],
      }),
    ]);
    expect(btcSignPsbt).toHaveBeenCalledTimes(1);
  });

  function buildTaprootRequest(inputCount = 1) {
    const psbt = new BitcoinJS.Psbt({ network: btcNetwork });
    for (let index = 0; index < inputCount; index += 1) {
      psbt.addInput({
        hash: Buffer.alloc(32, index + 1),
        index: 0,
        witnessUtxo: {
          script: BitcoinJS.address.toOutputScript(
            taprootAccountAddress,
            btcNetwork,
          ),
          value: 10_000n,
        },
        tapInternalKey: Buffer.from(publicKeyHex, 'hex').subarray(1),
      });
    }
    psbt.addOutput({
      address: recipientAddress,
      value: BigInt(inputCount * 10_000 - 1000),
    });
    return {
      unsignedTx: {
        encodedTx: {
          psbtHex: psbt.toHex(),
          inputsToSign: [
            {
              index: 0,
              address: taprootAccountAddress,
              publicKey: publicKeyHex,
            },
          ],
        },
      },
      deviceParams: {
        dbDevice: { connectId: 'keystone-wallet:test', deviceId: 'wallet-id' },
      },
    };
  }

  function buildTaprootKeyring(
    transform: (psbt: BitcoinJS.Psbt) => BitcoinJS.Psbt,
  ) {
    const btcSignPsbt = jest
      .fn()
      .mockImplementation(
        async (
          _connectId: string,
          _deviceId: string,
          request: { psbt: string },
        ) => ({
          success: true,
          payload: {
            signedPsbt: transform(
              BitcoinJS.Psbt.fromHex(request.psbt, { network: btcNetwork }),
            ).toHex(),
          },
        }),
      );
    const { keyring } = buildSigningKeyring({
      btcSignPsbt,
      btcGetMasterFingerprint: jest.fn().mockResolvedValue({
        success: true,
        payload: { masterFingerprint: 'aabbccdd' },
      }),
      addressEncoding: EAddressEncodings.P2TR,
      signingAccountAddress: taprootAccountAddress,
      signingAccountPath: "m/86'/0'/0'",
    });
    Object.assign(keyring.vault, {
      validateAddress: jest
        .fn()
        .mockResolvedValue({ encoding: EAddressEncodings.P2TR }),
    });
    return { keyring, btcSignPsbt };
  }

  it.each([false, true])(
    'rejects an unchanged unsigned PSBT with signOnly=%s',
    async (signOnly) => {
      const { keyring } = buildTaprootKeyring((psbt) => psbt);
      await expect(
        keyring.signPsbt({ ...buildTaprootRequest(), signOnly } as never),
      ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
    },
  );

  it.each([false, true])(
    'returns a complete transaction for a valid PSBT, already finalized=%s',
    async (finalized) => {
      const { keyring } = buildTaprootKeyring((psbt) => {
        psbt.signInput(0, taprootSigner);
        if (finalized) psbt.finalizeAllInputs();
        return psbt;
      });
      const result = await keyring.signPsbt({
        ...buildTaprootRequest(),
        signOnly: false,
      } as never);
      expect(
        BitcoinJS.Transaction.fromHex(result.rawTx).ins[0].witness,
      ).toHaveLength(1);
    },
  );

  it('preserves existing matching Taproot derivation and cosigner metadata', async () => {
    const params = buildTaprootRequest();
    const psbt = BitcoinJS.Psbt.fromHex(params.unsignedTx.encodedTx.psbtHex);
    const derivations = [
      {
        masterFingerprint: Buffer.from('aabbccdd', 'hex'),
        pubkey: Buffer.from(publicKeyHex, 'hex').subarray(1),
        path: "m/86'/0'/0'/0/0",
        leafHashes: [],
      },
      {
        masterFingerprint: Buffer.from('11223344', 'hex'),
        pubkey: Buffer.from('03'.repeat(32), 'hex'),
        path: "m/86'/0'/1'/0/0",
        leafHashes: [Buffer.alloc(32, 4)],
      },
    ];
    psbt.updateInput(0, { tapBip32Derivation: derivations });
    params.unsignedTx.encodedTx.psbtHex = psbt.toHex();
    const { keyring, btcSignPsbt } = buildTaprootKeyring((value) =>
      value.data.inputs[0].tapKeySig
        ? value
        : value.signInput(0, taprootSigner),
    );
    const signed = await keyring.signPsbt({
      ...params,
      signOnly: true,
    } as never);
    expect(btcSignPsbt.mock.calls[0][2].psbt).toBe(psbt.toHex());
    await expect(
      keyring.signPsbt({
        ...params,
        unsignedTx: {
          encodedTx: {
            ...params.unsignedTx.encodedTx,
            psbtHex: signed.psbtHex,
          },
        },
        signOnly: true,
      } as never),
    ).resolves.toBeDefined();
  });

  it('accepts an x-only requested key when derivation uses the account fallback', async () => {
    const params = buildTaprootRequest();
    params.unsignedTx.encodedTx.inputsToSign[0].publicKey =
      publicKeyHex.slice(2);
    const { keyring, btcSignPsbt } = buildTaprootKeyring((value) =>
      value.signInput(0, taprootSigner),
    );
    Object.assign(keyring.vault, {
      prepareBtcSignExtraInfo: jest
        .fn()
        .mockResolvedValue({ btcExtraInfo: { addressToPath: {} } }),
    });
    await expect(
      keyring.signPsbt({ ...params, signOnly: true } as never),
    ).resolves.toBeDefined();
    const submitted = BitcoinJS.Psbt.fromHex(btcSignPsbt.mock.calls[0][2].psbt);
    expect(
      Buffer.from(
        submitted.data.inputs[0].tapBip32Derivation![0].pubkey,
      ).toString('hex'),
    ).toBe(publicKeyHex.slice(2));
  });

  it.each(['fingerprint', 'path'] as const)(
    'rejects conflicting existing Taproot %s before signing',
    async (conflict) => {
      const params = buildTaprootRequest();
      const psbt = BitcoinJS.Psbt.fromHex(params.unsignedTx.encodedTx.psbtHex);
      psbt.updateInput(0, {
        tapBip32Derivation: [
          {
            masterFingerprint: Buffer.from(
              conflict === 'fingerprint' ? '11223344' : 'aabbccdd',
              'hex',
            ),
            pubkey: Buffer.from(publicKeyHex, 'hex').subarray(1),
            path: conflict === 'path' ? "m/86'/0'/0'/0/1" : "m/86'/0'/0'/0/0",
            leafHashes: [],
          },
        ],
      });
      params.unsignedTx.encodedTx.psbtHex = psbt.toHex();
      const { keyring, btcSignPsbt } = buildTaprootKeyring((value) =>
        value.signInput(0, taprootSigner),
      );
      await expect(
        keyring.signPsbt({ ...params, signOnly: true } as never),
      ).rejects.toThrow('BTC Taproot derivation mismatch');
      expect(btcSignPsbt).not.toHaveBeenCalled();
    },
  );

  it('preserves a verified partial PSBT only for signOnly requests', async () => {
    const { keyring } = buildTaprootKeyring((psbt) =>
      psbt.signInput(0, taprootSigner),
    );
    const params = buildTaprootRequest(2);
    const result = await keyring.signPsbt({
      ...params,
      signOnly: true,
    } as never);
    expect(result.rawTx).toBe('');
    expect(
      BitcoinJS.Psbt.fromHex(result.psbtHex!).data.inputs[0].tapKeySig,
    ).toBeDefined();
    expect(
      BitcoinJS.Psbt.fromHex(result.psbtHex!).data.inputs[1].tapKeySig,
    ).toBeUndefined();
    await expect(
      keyring.signPsbt({ ...params, signOnly: false } as never),
    ).rejects.toMatchObject({
      key: ETranslations.feedback_failed_to_sign_transaction,
    });
  });

  it.each([false, true])(
    'preserves incomplete Taproot script signatures without finalizing, device finalized=%s',
    async (finalized) => {
      const cosigner = getBitcoinECPair().fromPrivateKey(
        Buffer.from('02'.padStart(64, '0'), 'hex'),
      );
      const script = BitcoinJS.script.compile([
        signer.publicKey.slice(1),
        BitcoinJS.opcodes.OP_CHECKSIGVERIFY,
        cosigner.publicKey.slice(1),
        BitcoinJS.opcodes.OP_CHECKSIG,
      ]);
      const payment = BitcoinJS.payments.p2tr({
        internalPubkey: cosigner.publicKey.slice(1),
        scriptTree: { output: script },
        redeem: { output: script, redeemVersion: 0xc0 },
        network: btcNetwork,
      });
      const psbt = new BitcoinJS.Psbt({ network: btcNetwork });
      psbt.addInput({
        hash: Buffer.alloc(32, 1),
        index: 0,
        witnessUtxo: { script: payment.output!, value: 10_000n },
        tapInternalKey: cosigner.publicKey.slice(1),
        tapLeafScript: [
          {
            script,
            leafVersion: 0xc0,
            controlBlock: payment.witness![payment.witness!.length - 1],
          },
        ],
      });
      const leafHash = tapleafHash({ output: script, version: 0xc0 });
      psbt.updateInput(0, {
        tapBip32Derivation: [
          {
            masterFingerprint: Buffer.from('aabbccdd', 'hex'),
            pubkey: signer.publicKey.slice(1),
            path: "m/86'/0'/0'/0/0",
            leafHashes: [leafHash],
          },
        ],
      });
      psbt.addOutput({ address: recipientAddress, value: 9000n });
      const params = buildTaprootRequest();
      params.unsignedTx.encodedTx.psbtHex = psbt.toHex();
      const { keyring } = buildTaprootKeyring((submitted) => {
        expect(
          submitted.data.inputs[0].tapBip32Derivation?.[0].leafHashes,
        ).toEqual([leafHash]);
        submitted.signInput(0, signer);
        if (finalized) submitted.finalizeAllInputs();
        return submitted;
      });
      const result = await keyring.signPsbt({
        ...params,
        signOnly: true,
      } as never);
      expect(result.rawTx).toBe('');
      expect(result.finalizedPsbtHex).toBe(result.psbtHex);
      const input = BitcoinJS.Psbt.fromHex(result.psbtHex!).data.inputs[0];
      expect(input.tapScriptSig).toHaveLength(1);
      expect(input.finalScriptWitness).toBeUndefined();
      await expect(
        keyring.signPsbt({ ...params, signOnly: false } as never),
      ).rejects.toMatchObject({
        key: ETranslations.feedback_failed_to_sign_transaction,
      });
    },
  );

  it('rejects a signed PSBT whose outputs differ from the submitted one', async () => {
    const attackerAddress = BitcoinJS.payments.p2wpkh({
      pubkey: Buffer.from(
        '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
        'hex',
      ),
      network: btcNetwork,
    }).address!;
    const btcSignPsbt = jest
      .fn()
      .mockImplementation(
        async (
          _connectId: string,
          _deviceId: string,
          request: { psbt: string },
        ) => {
          const submitted = BitcoinJS.Psbt.fromHex(request.psbt, {
            network: btcNetwork,
          });
          const tampered = new BitcoinJS.Psbt({ network: btcNetwork });
          tampered.addInput({
            hash: submitted.txInputs[0].hash,
            index: submitted.txInputs[0].index,
          });
          tampered.addOutput({ address: attackerAddress, value: 9000n });
          return {
            success: true,
            payload: { signedPsbt: tampered.toHex() },
          };
        },
      );
    const btcGetMasterFingerprint = jest.fn().mockResolvedValue({
      success: true,
      payload: { masterFingerprint: 'aabbccdd' },
    });
    const { keyring } = buildSigningKeyring({
      btcSignPsbt,
      btcGetMasterFingerprint,
    });

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx: {
            inputs: [
              {
                txid: '00'.repeat(32),
                vout: 0,
                value: '10000',
                address: accountAddress,
                path: fullPath,
              },
            ],
            outputs: [{ address: recipientAddress, value: '9000' }],
          },
        },
        signOnly: false,
        deviceParams: {
          dbDevice: {
            id: 'device-1',
            connectId: 'keystone-wallet:test',
            deviceId: 'wallet-id',
          },
        },
      } as never),
    ).rejects.toBeInstanceOf(OneKeyLocalError);
    // The device was reached, so the rejection can only come from the
    // post-signing PSBT comparison.
    expect(btcSignPsbt).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-taproot dApp PSBT before contacting the device', async () => {
    const btcSignPsbt = jest.fn();
    const btcGetMasterFingerprint = jest.fn();
    const { keyring, getAdapterForVendor } = buildSigningKeyring({
      btcSignPsbt,
      btcGetMasterFingerprint,
    });

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx: {
            psbtHex: new BitcoinJS.Psbt({ network: btcNetwork }).toHex(),
            inputsToSign: [
              {
                index: 0,
                address: accountAddress,
                publicKey: publicKeyHex,
              },
            ],
          },
        },
        signOnly: true,
        deviceParams: {
          dbDevice: {
            connectId: 'keystone-wallet:test',
            deviceId: 'wallet-id',
          },
        },
      } as never),
    ).rejects.toBeInstanceOf(AddressNotSupportSignMethodError);
    expect(getAdapterForVendor).not.toHaveBeenCalled();
    expect(btcSignPsbt).not.toHaveBeenCalled();
  });
});

describe('KeyringHardwareKeystone.signMessage', () => {
  const root = getBitcoinBip32().fromSeed(Buffer.alloc(32, 7));
  const accountPath = "m/84'/0'/0'";
  const deviceParams = {
    dbDevice: { connectId: 'keystone-wallet:test', deviceId: 'wallet-id' },
  };
  const params = {
    messages: [{ message: 'hello', type: 'ecdsa' }],
    password: '',
    deviceParams,
  };
  function signatureFor(
    path: string,
    message = 'hello',
    segwitType?: 'p2wpkh' | 'p2sh(p2wpkh)',
  ) {
    return bitcoinMessage
      .sign(message, root.derivePath(path).privateKey!, true, { segwitType })
      .toString('hex');
  }
  function buildKeyring(signature: string, path = accountPath) {
    const accountNode = root.derivePath(path);
    const btcSignMessage = jest
      .fn()
      .mockResolvedValue({ success: true, payload: { signature } });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest
              .fn()
              .mockResolvedValue({ hw: { btcSignMessage } }),
          },
        },
        vault: {
          getAccount: jest.fn().mockResolvedValue({
            path,
            relPath: '0/0',
            xpub: accountNode.neutered().toBase58(),
          }),
        },
        getCoreApiNetworkInfo: jest
          .fn()
          .mockResolvedValue({ networkChainCode: 'btc' }),
      },
    ) as KeyringHardwareKeystone;
    return { keyring, btcSignMessage };
  }

  it.each([undefined, 'p2wpkh', 'p2sh(p2wpkh)'] as const)(
    'verifies compact message signatures with header type %s',
    async (segwitType) => {
      const signature = signatureFor(`${accountPath}/0/0`, 'hello', segwitType);
      const { keyring } = buildKeyring(signature);
      await expect(keyring.signMessage(params as never)).resolves.toEqual([
        signature,
      ]);
    },
  );

  it('verifies the selected receive path instead of the default address', async () => {
    const path = `${accountPath}/1/2`;
    const signature = signatureFor(path);
    const { keyring, btcSignMessage } = buildKeyring(signature);
    await expect(
      keyring.signMessage({
        ...params,
        chainExtraParams: { receiveAddressPath: path },
      } as never),
    ).resolves.toEqual([signature]);
    expect(btcSignMessage).toHaveBeenCalledWith(
      'keystone-wallet:test',
      'wallet-id',
      expect.objectContaining({ path }),
    );
    await expect(keyring.signMessage(params as never)).rejects.toBeInstanceOf(
      ThirdPartyDeviceMismatch,
    );
  });

  it('preserves legacy ECDSA message signing from a Taproot account path', async () => {
    const path = "m/86'/0'/0'";
    const signature = signatureFor(`${path}/0/0`);
    const { keyring } = buildKeyring(signature, path);
    await expect(keyring.signMessage(params as never)).resolves.toEqual([
      signature,
    ]);
  });

  it.each([
    signatureFor("m/84'/0'/1'/0/0"),
    signatureFor(`${accountPath}/0/0`, 'other message'),
    'invalid',
    `${signatureFor(`${accountPath}/0/0`)}zz`,
    `00${signatureFor(`${accountPath}/0/0`).slice(2)}`,
  ])(
    'rejects a wrong signer, wrong message or malformed signature (%#)',
    async (signature) => {
      const { keyring } = buildKeyring(signature);
      await expect(keyring.signMessage(params as never)).rejects.toBeInstanceOf(
        ThirdPartyDeviceMismatch,
      );
    },
  );

  it('rejects a receive path outside the account before signing', async () => {
    const { keyring, btcSignMessage } = buildKeyring(
      signatureFor(`${accountPath}/0/0`),
    );
    await expect(
      keyring.signMessage({
        ...params,
        chainExtraParams: { receiveAddressPath: "m/84'/0'/1'/0/0" },
      } as never),
    ).rejects.toThrow('BTC message path does not belong to the account');
    expect(btcSignMessage).not.toHaveBeenCalled();
  });

  it('keeps BIP-322 unsupported before contacting the device', async () => {
    const { keyring, btcSignMessage } = buildKeyring(
      signatureFor(`${accountPath}/0/0`),
    );
    await expect(
      keyring.signMessage({
        ...params,
        messages: [{ type: 'bip322-simple', message: 'hello' }],
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyMethodNotSupported);
    expect(btcSignMessage).not.toHaveBeenCalled();
  });
});
