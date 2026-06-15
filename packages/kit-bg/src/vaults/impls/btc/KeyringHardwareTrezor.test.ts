import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { EMessageTypesBtc } from '@onekeyhq/shared/types/message';

import { EDBAccountType } from '../../../dbs/local/consts';

import {
  KeyringHardwareTrezor,
  buildTrezorBtcSignMessageParams,
  buildTrezorBtcSignTransactionPayload,
  getTrezorBtcRawPrevTxsToParse,
  getTrezorBtcScriptTypeFromPath,
} from './KeyringHardwareTrezor';

import type { IDBUtxoAccount } from '../../../dbs/local/types';

describe('getTrezorBtcScriptTypeFromPath', () => {
  it('uses the purpose segment instead of matching any path segment', () => {
    expect(getTrezorBtcScriptTypeFromPath("m/44'/0'/86'/0/0")).toBe('p2pkh');
    expect(getTrezorBtcScriptTypeFromPath("m/49'/0'/0'/0/0")).toBe('p2sh');
    expect(getTrezorBtcScriptTypeFromPath("m/84'/0'/0'/0/0")).toBe('p2wpkh');
    expect(getTrezorBtcScriptTypeFromPath("m/86'/0'/0'/0/0")).toBe('p2tr');
  });
});

describe('KeyringHardwareTrezor.prepareAccounts', () => {
  it('builds P2TR descriptors from the Trezor master fingerprint, not passphraseState', async () => {
    const btcGetPublicKey = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        xpub:
          'xpub6CsXcwbJS7Go9ZmTiQjZF6dG6mhmTBEoKzxymQUwMsynCXEK' +
          'AMXrzh8oym3vehjorx16T7mGuqCRKkZ84Zfc7PKuKVkBcCLn46VZCUXPWTH',
      },
    });
    const btcGetMasterFingerprint = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        masterFingerprint: 'aabbccdd',
      },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareTrezor.prototype),
      {
        walletId: 'hw-wallet-id',
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              hw: {
                btcGetPublicKey,
                btcGetMasterFingerprint,
              },
            }),
            requestTrezorBleConnectIdForDevice: jest.fn(),
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
            addresses: {
              '0/0': 'bc1paddress',
            },
            publicKeys: {
              '0/0': '02'.padEnd(66, '0'),
            },
            xpubSegwit: 'tr(bare-xpub)',
          }),
        },
      },
    ) as KeyringHardwareTrezor;

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
          connectId: 'USB_CONNECT_ID',
          deviceId: 'FEATURES_DEVICE_ID',
        },
        deviceCommonParams: {
          passphraseState: '02'.padEnd(66, '1'),
        },
      },
    } as any);

    expect(btcGetMasterFingerprint).toHaveBeenCalledWith(
      'USB_CONNECT_ID',
      'FEATURES_DEVICE_ID',
      {
        passphraseState: '02'.padEnd(66, '1'),
      },
    );
    const utxoAccount = account as IDBUtxoAccount;
    expect(utxoAccount.xpubSegwit).toContain('tr([aabbccdd/86');
    expect(utxoAccount.xpubSegwit).not.toContain('tr([021111');
  });
});

describe('buildTrezorBtcSignTransactionPayload', () => {
  it('skips raw prevTx parsing when a structured origRefTx already covers the txid', () => {
    const structuredTxid = 'a'.repeat(64);
    const rawPrevTxs = {
      [structuredTxid]: 'unsupported-special-raw-tx',
      ['b'.repeat(64)]: 'normal-raw-tx',
    };

    expect(
      getTrezorBtcRawPrevTxsToParse({
        rawPrevTxs,
        origRefTxs: [
          {
            hash: structuredTxid,
            version: 2,
            inputs: [],
            outputs: [],
            locktime: 0,
          },
        ],
      }),
    ).toEqual(['normal-raw-tx']);
  });

  it('preserves BTC input sequence and transaction version/locktime for Trezor SignTx', () => {
    const inputAddress = 'input-address';
    const payload = buildTrezorBtcSignTransactionPayload({
      coin: 'btc',
      encodedTx: {
        inputs: [
          {
            txid: '0'.repeat(64),
            vout: 1,
            value: '12345',
            address: inputAddress,
            path: '',
            sequence: 0xff_ff_ff_fd,
          },
        ],
        outputs: [
          {
            address: 'bc1qrecipient',
            value: '10000',
          },
        ],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: '2345',
        version: 2,
        locktime: 800_000,
        txSize: 141,
      },
      prevTxs: [],
      signers: {
        [inputAddress]: "m/84'/0'/0'/0/0",
      },
    });

    expect(payload).toEqual({
      coin: 'btc',
      version: 2,
      locktime: 800_000,
      inputs: [
        {
          path: "m/84'/0'/0'/0/0",
          prevHash: '0'.repeat(64),
          prevIndex: 1,
          amount: '12345',
          sequence: 0xff_ff_ff_fd,
          scriptType: 'p2wpkh',
        },
      ],
      outputs: [
        {
          address: 'bc1qrecipient',
          amount: '10000',
        },
      ],
      refTxs: [],
    });
  });

  it('preserves BTC fork fields for the current Trezor SignTx request', () => {
    const inputAddress = 'input-address';
    const payload = buildTrezorBtcSignTransactionPayload({
      coin: 'zec',
      encodedTx: {
        inputs: [
          {
            txid: '6'.repeat(64),
            vout: 0,
            value: '12345',
            address: inputAddress,
            path: '',
          },
        ],
        outputs: [
          {
            address: 't1recipient',
            value: '10000',
          },
        ],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: '2345',
        version: 4,
        locktime: 800_001,
        timestamp: 123,
        expiry: 456,
        versionGroupId: 0x89_2f_20_85,
        branchId: 0xbb_09_b8_76,
        txSize: 141,
      },
      prevTxs: [],
      signers: {
        [inputAddress]: "m/44'/133'/0'/0/0",
      },
    });

    expect(payload).toEqual(
      expect.objectContaining({
        coin: 'zec',
        version: 4,
        locktime: 800_001,
        timestamp: 123,
        expiry: 456,
        versionGroupId: 0x89_2f_20_85,
        branchId: 0xbb_09_b8_76,
      }),
    );
  });

  it('builds change outputs with a path for Trezor change verification', () => {
    const inputAddress = 'input-address';
    const payload = buildTrezorBtcSignTransactionPayload({
      coin: 'btc',
      encodedTx: {
        inputs: [
          {
            txid: '1'.repeat(64),
            vout: 0,
            value: '20000',
            address: inputAddress,
            path: '',
          },
        ],
        outputs: [
          {
            address: 'bc1qchange',
            value: '5000',
            payload: {
              isChange: true,
              bip44Path: "m/84'/0'/0'/1/0",
            },
          },
        ],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: '15000',
        txSize: 141,
      },
      prevTxs: [],
      signers: {
        [inputAddress]: "m/84'/0'/0'/0/0",
      },
    });

    expect(payload.outputs).toEqual([
      {
        path: "m/84'/0'/0'/1/0",
        amount: '5000',
        scriptType: 'p2wpkh',
      },
    ]);
  });

  it('falls back to the encoded input path when the signer lookup misses', () => {
    const payload = buildTrezorBtcSignTransactionPayload({
      coin: 'btc',
      encodedTx: {
        inputs: [
          {
            txid: '3'.repeat(64),
            vout: 0,
            value: '30000',
            address: 'input-address',
            path: "m/84'/0'/0'/0/3",
          },
        ],
        outputs: [
          {
            address: 'bc1qrecipient',
            value: '25000',
          },
        ],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: '5000',
        txSize: 141,
      },
      prevTxs: [],
      signers: {},
    });

    expect(payload.inputs[0]).toEqual({
      path: "m/84'/0'/0'/0/3",
      prevHash: '3'.repeat(64),
      prevIndex: 0,
      amount: '30000',
      sequence: undefined,
      scriptType: 'p2wpkh',
    });
  });

  it('builds OP_RETURN outputs for Trezor SignTx', () => {
    const inputAddress = 'input-address';
    const payload = buildTrezorBtcSignTransactionPayload({
      coin: 'btc',
      encodedTx: {
        inputs: [
          {
            txid: '2'.repeat(64),
            vout: 0,
            value: '20000',
            address: inputAddress,
            path: '',
          },
        ],
        outputs: [
          {
            address: '',
            value: '0',
            payload: {
              opReturn: 'hello',
            },
          },
        ],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: '20000',
        txSize: 141,
      },
      prevTxs: [],
      signers: {
        [inputAddress]: "m/84'/0'/0'/0/0",
      },
    });

    expect(payload.outputs).toEqual([
      {
        opReturnData: '68656c6c6f',
        amount: '0',
      },
    ]);
  });

  it('passes SLIP-24 payment requests and original transaction metadata through to the Trezor SDK', () => {
    const origHash = 'a'.repeat(64);
    const inputAddress = 'input-address';
    const payload = buildTrezorBtcSignTransactionPayload({
      coin: 'btc',
      encodedTx: {
        inputs: [
          {
            txid: '4'.repeat(64),
            vout: 1,
            value: '120000',
            address: inputAddress,
            path: '',
            sequence: 0xff_ff_ff_fd,
            origHash,
            origIndex: 0,
          },
        ],
        outputs: [
          {
            address: 'bc1qrecipient',
            value: '100000',
            paymentReqIndex: 0,
            origHash,
            origIndex: 0,
          },
        ],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: '20000',
        txSize: 141,
        paymentRequests: [
          {
            nonce: 'nonce-1',
            recipientName: 'Merchant',
            amount: '100000',
            signature: 'ab'.repeat(64),
            memos: [{ textMemo: { text: 'order #1' } }],
          },
        ],
        origRefTxs: [
          {
            hash: origHash,
            version: 2,
            inputs: [],
            outputs: [],
            locktime: 0,
            origInputs: [
              {
                path: "m/84'/0'/0'/0/0",
                prevHash: '5'.repeat(64),
                prevIndex: 0,
                amount: '120000',
                sequence: 0xff_ff_ff_fd,
                scriptType: 'p2wpkh',
                scriptSig: '00',
                witness: '11',
              },
            ],
            origOutputs: [
              {
                path: "m/84'/0'/0'/1/0",
                amount: '100000',
                scriptType: 'p2wpkh',
              },
            ],
          },
        ],
      } as any,
      prevTxs: [],
      signers: {
        [inputAddress]: "m/84'/0'/0'/0/0",
      },
    });

    expect(payload.inputs[0]).toEqual({
      path: "m/84'/0'/0'/0/0",
      prevHash: '4'.repeat(64),
      prevIndex: 1,
      amount: '120000',
      sequence: 0xff_ff_ff_fd,
      scriptType: 'p2wpkh',
      origHash,
      origIndex: 0,
    });
    expect(payload.outputs[0]).toEqual({
      address: 'bc1qrecipient',
      amount: '100000',
      paymentReqIndex: 0,
      origHash,
      origIndex: 0,
    });
    expect(payload.paymentRequests).toEqual([
      {
        nonce: 'nonce-1',
        recipientName: 'Merchant',
        amount: '100000',
        signature: 'ab'.repeat(64),
        memos: [{ textMemo: { text: 'order #1' } }],
      },
    ]);
    expect(payload.refTxs).toEqual([
      {
        hash: origHash,
        version: 2,
        inputs: [],
        outputs: [],
        locktime: 0,
        origInputs: [
          {
            path: "m/84'/0'/0'/0/0",
            prevHash: '5'.repeat(64),
            prevIndex: 0,
            amount: '120000',
            sequence: 0xff_ff_ff_fd,
            scriptType: 'p2wpkh',
            scriptSig: '00',
            witness: '11',
          },
        ],
        origOutputs: [
          {
            path: "m/84'/0'/0'/1/0",
            amount: '100000',
            scriptType: 'p2wpkh',
          },
        ],
      },
    ]);
  });
});

describe('buildTrezorBtcSignMessageParams', () => {
  it('builds current Trezor connector message params with a hex message payload', () => {
    expect(
      buildTrezorBtcSignMessageParams({
        path: "m/84'/0'/0'/0/0",
        coin: 'btc',
        message: {
          type: EMessageTypesBtc.ECDSA,
          message: 'Hello World',
        },
      }),
    ).toEqual({
      path: "m/84'/0'/0'/0/0",
      coin: 'btc',
      message: '48656c6c6f20576f726c64',
      hex: true,
    });
  });

  it('passes noScriptType for BTC message modes that request Electrum-style signatures', () => {
    expect(
      buildTrezorBtcSignMessageParams({
        path: "m/84'/0'/0'/0/0",
        coin: 'btc',
        message: {
          type: EMessageTypesBtc.ECDSA,
          message: 'Hello World',
          payload: {
            isFromDApp: true,
          },
        },
      }),
    ).toEqual({
      path: "m/84'/0'/0'/0/0",
      coin: 'btc',
      message: '48656c6c6f20576f726c64',
      hex: true,
      noScriptType: true,
    });

    expect(
      buildTrezorBtcSignMessageParams({
        path: "m/84'/0'/0'/0/0",
        coin: 'btc',
        message: {
          type: EMessageTypesBtc.ECDSA,
          message: 'Hello World',
          sigOptions: {
            noScriptType: true,
          },
        },
      }),
    ).toEqual({
      path: "m/84'/0'/0'/0/0",
      coin: 'btc',
      message: '48656c6c6f20576f726c64',
      hex: true,
      noScriptType: true,
    });
  });

  it('rejects BTC BIP322 message signing as unsupported by Trezor', () => {
    expect(() =>
      buildTrezorBtcSignMessageParams({
        path: "m/84'/0'/0'/0/0",
        coin: 'btc',
        message: {
          type: EMessageTypesBtc.BIP322_SIMPLE,
          message: 'Hello World',
        },
      }),
    ).toThrow(ThirdPartyMethodNotSupported);
  });
});
