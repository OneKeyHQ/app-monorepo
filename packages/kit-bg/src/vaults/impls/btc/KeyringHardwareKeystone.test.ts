import * as BitcoinJS from 'bitcoinjs-lib';

import {
  getBtcForkNetwork,
  initBitcoinEcc,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { AddressNotSupportSignMethodError } from '@onekeyhq/shared/src/errors';

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
          interactionId: 'hwk-keystone-interaction',
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
            interactionId: 'hwk-keystone-interaction',
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
      { interactionId: 'hwk-keystone-interaction', knownConnections: [] },
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
          return {
            success: true,
            payload: { signedPsbt: request.psbt },
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
          return {
            success: true,
            payload: { signedPsbt: request.psbt },
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
