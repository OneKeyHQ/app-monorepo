import { Psbt, Transaction } from 'bitcoinjs-lib';

import { SignerHardware } from '../signer/impls/btc/SignerHardware';

import type { DeviceInfo } from '../core/auth/auth-types';
import type { ISignerHardwareDeps } from '../signer/base/SignerHardwareBase';
import type { CoreApi } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/core/src/secret', () => ({
  revealableSeedFromMnemonic: jest.fn(),
}));

jest.mock('bitcoinjs-lib', () => {
  const actual =
    jest.requireActual<typeof import('bitcoinjs-lib')>('bitcoinjs-lib');
  return {
    ...actual,
    Psbt: {
      fromHex: jest.fn(),
    },
  };
});

jest.mock('../commands/device/hardware-sdk', () => {
  const actual = jest.requireActual<
    typeof import('../commands/device/hardware-sdk')
  >('../commands/device/hardware-sdk');
  return {
    ...actual,
    CoreSDKLoader: jest.fn(async () => ({
      getHDPath: (path: string) =>
        path
          .replace(/^m\//, '')
          .split('/')
          .map((part) => {
            const hardened = part.endsWith("'");
            const value = Number(part.replace(/'/g, ''));
            return hardened ? value + 0x80_00_00_00 : value;
          }),
      getScriptType: jest.fn(() => 'SPENDWITNESS'),
      getOutputScriptType: jest.fn(() => 'PAYTOWITNESS'),
    })),
  };
});

function makeSuccess<T>(payload: T) {
  return { success: true as const, payload };
}

function makeDevice(): DeviceInfo {
  return {
    connectId: 'connect-123',
    deviceId: 'device-abc',
    deviceLabel: 'OneKey Touch',
  };
}

function makeDeps(overrides: { sdk?: Partial<CoreApi> } = {}): {
  deps: ISignerHardwareDeps;
  mocks: {
    sdk: jest.Mocked<CoreApi>;
    installPassphraseProvider: jest.Mock;
  };
} {
  const device = makeDevice();
  const sdk = {
    getFeatures: jest.fn(async () => makeSuccess({ unlocked: true })),
    deviceUnlock: jest.fn(async () => makeSuccess({})),
    searchDevices: jest.fn(async () =>
      makeSuccess([
        {
          connectId: device.connectId,
          deviceId: device.deviceId,
          features: { device_id: device.deviceId, session_id: 'session-123' },
        },
      ]),
    ),
    btcGetAddress: jest.fn(async () =>
      makeSuccess({ address: 'tb1p-first', path: "m/86'/1'/0'/0/0" }),
    ),
    btcGetPublicKey: jest.fn(async () =>
      makeSuccess({
        path: "m/86'/1'/0'/0/0",
        node: {
          public_key:
            '03098891dd952dd6f6bde1489761d0befbfa31815e9c0e64058d12b83de852a18c',
        },
        root_fingerprint: 0xde_ad_be_ef,
      }),
    ),
    btcSignTransaction: jest.fn(async () =>
      makeSuccess({ serializedTx: makeSignedTxHex(), txid: undefined }),
    ),
    btcSignPsbt: jest.fn(async () => makeSuccess({ psbt: 'signed-psbt-hex' })),
    ...overrides.sdk,
  } as unknown as jest.Mocked<CoreApi>;

  const installPassphraseProvider = jest.fn();
  const deps: ISignerHardwareDeps = {
    ensureSDKReady: jest.fn(
      async () => sdk,
    ) as unknown as ISignerHardwareDeps['ensureSDKReady'],
    installPassphraseProvider,
    resolvePassphraseStateByMode:
      jest.fn() as unknown as ISignerHardwareDeps['resolvePassphraseStateByMode'],
    keychainFactory: () => ({
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
    }),
    preloadSessionCache: jest.fn(),
    stderr: { write: jest.fn(() => true) },
  };

  return { deps, mocks: { sdk, installPassphraseProvider } };
}

function makePrevTxHex(): string {
  const prevHash = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
  const tx = new Transaction();
  tx.version = 2;
  tx.addInput(prevHash, 0, 0xff_ff_ff_fd, Buffer.from('51', 'hex'));
  tx.addOutput(Buffer.from('51', 'hex'), 1234n);
  return tx.toHex();
}

function makeSignedTxHex(): string {
  const tx = new Transaction();
  tx.version = 2;
  tx.addInput(Buffer.alloc(32, 2), 1, 0xff_ff_ff_fd, Buffer.from('51', 'hex'));
  tx.addOutput(Buffer.from('51', 'hex'), 1000n);
  return tx.toHex();
}

function getPsbtFromHexMock(): jest.Mock {
  const { fromHex } = Psbt as unknown as { fromHex: jest.Mock };
  return fromHex;
}

describe('btc hardware signer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPsbtFromHexMock().mockReset();
  });

  it('derives tbtc taproot address through hardware SDK', async () => {
    const device = makeDevice();
    const { deps, mocks } = makeDeps();
    const signer = new SignerHardware({
      impl: 'tbtc',
      device,
      passphraseMode: 'none',
      deps,
    });

    const address = await signer.getAddress('tbtc--0', {
      addressType: 'taproot',
    });

    expect(address).toEqual({
      address: 'tb1p-first',
      publicKey:
        '03098891dd952dd6f6bde1489761d0befbfa31815e9c0e64058d12b83de852a18c',
      path: "m/86'/1'/0'/0/0",
      relPath: '0/0',
      addresses: { '0/0': 'tb1p-first' },
      __hwExtraInfo__: { rootFingerprint: 0xde_ad_be_ef },
    });
    expect(mocks.sdk.btcGetAddress).toHaveBeenCalledWith(
      device.connectId,
      device.deviceId,
      {
        path: "m/86'/1'/0'/0/0",
        coin: 'testnet',
        showOnOneKey: false,
        useEmptyPassphrase: true,
        skipPassphraseCheck: true,
      },
    );
    expect(mocks.sdk.btcGetPublicKey).toHaveBeenCalledWith(
      device.connectId,
      device.deviceId,
      {
        path: "m/86'/1'/0'/0/0",
        coin: 'testnet',
        showOnOneKey: false,
        useEmptyPassphrase: true,
        skipPassphraseCheck: true,
      },
    );
  });

  it('rejects getAddress without explicit addressType', async () => {
    const { deps, mocks } = makeDeps();
    const signer = new SignerHardware({
      impl: 'btc',
      device: makeDevice(),
      passphraseMode: 'none',
      deps,
    });

    await expect(signer.getAddress('btc--0')).rejects.toThrow(
      /requires addressType/,
    );
    expect(mocks.sdk.btcGetAddress).not.toHaveBeenCalled();
  });

  it('converts normal btc transaction for hardware signing and returns txid', async () => {
    const device = makeDevice();
    const signedTxHex = makeSignedTxHex();
    const { deps, mocks } = makeDeps({
      sdk: {
        btcSignTransaction: jest.fn(async () =>
          makeSuccess({ serializedTx: signedTxHex, txid: undefined }),
        ),
      } as unknown as Partial<CoreApi>,
    });
    const signer = new SignerHardware({
      impl: 'btc',
      device,
      passphraseMode: 'none',
      deps,
    });
    const encodedTx = {
      inputs: [
        {
          txid: 'prev-txid',
          vout: 1,
          value: '5000',
          address: 'bc1q-input',
        },
      ],
      outputs: [
        { address: 'bc1q-payee', value: '3000' },
        {
          address: 'bc1q-change',
          value: '1900',
          payload: { isChange: true, bip44Path: "m/84'/0'/0'/1/0" },
        },
        {
          address: '',
          value: '0',
          payload: { opReturn: 'hello' },
        },
      ],
    };

    const result = await signer.signTransaction({
      networkId: 'btc--0',
      account: {
        address: 'bc1q-input',
        path: "m/84'/0'/0'/0/0",
      },
      unsignedTx: { encodedTx },
      btcExtraInfo: {
        pathToAddresses: {},
        addressToPath: {
          'bc1q-input': {
            address: 'bc1q-input',
            relPath: '0/0',
            fullPath: "m/84'/0'/0'/0/1",
          },
        },
        nonWitnessPrevTxs: {
          'prev-txid': makePrevTxHex(),
        },
      },
    });

    expect(mocks.sdk.btcSignTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.sdk.btcSignTransaction).toHaveBeenCalledWith(
      device.connectId,
      device.deviceId,
      expect.objectContaining({
        coin: 'bitcoin',
        inputs: [
          expect.objectContaining({
            prev_index: 1,
            prev_hash: 'prev-txid',
            amount: '5000',
            address_n: [2_147_483_732, 2_147_483_648, 2_147_483_648, 0, 1],
            script_type: 'SPENDWITNESS',
          }),
        ],
        outputs: [
          {
            script_type: 'PAYTOADDRESS',
            address: 'bc1q-payee',
            amount: '3000',
          },
          {
            script_type: 'PAYTOWITNESS',
            address_n: [2_147_483_732, 2_147_483_648, 2_147_483_648, 1, 0],
            amount: '1900',
          },
          {
            script_type: 'PAYTOOPRETURN',
            amount: '0',
            op_return_data: Buffer.from('hello').toString('hex'),
          },
        ],
        refTxs: [
          expect.objectContaining({
            version: 2,
            inputs: [
              expect.objectContaining({
                prev_hash:
                  '1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100',
                prev_index: 0,
                sequence: 0xff_ff_ff_fd,
              }),
            ],
            bin_outputs: [
              {
                amount: '1234',
                script_pubkey: '51',
              },
            ],
          }),
        ],
        useEmptyPassphrase: true,
        skipPassphraseCheck: true,
      }),
    );
    expect(result).toEqual({
      rawTx: signedTxHex,
      txid: Transaction.fromHex(signedTxHex).getId(),
      encodedTx,
    });
  });

  it('signs PSBT hex in signOnly mode without putting PSBT data in rawTx', async () => {
    const device = makeDevice();
    const { deps, mocks } = makeDeps();
    const signer = new SignerHardware({
      impl: 'tbtc',
      device,
      passphraseMode: 'none',
      deps,
    });
    const encodedTx = { psbtHex: '70736274ff0100' };
    // PSBT path is enriched in-place; spy on toHex so we can verify the SDK
    // received the enriched (or, with no inputsToSign, untouched) PSBT.
    const toHex = jest.fn(() => '70736274ff0100');
    getPsbtFromHexMock().mockReturnValue({
      finalizeInput: jest.fn(),
      extractTransaction: jest.fn(),
      toHex,
      updateInput: jest.fn(),
    });

    const result = await signer.signTransaction({
      networkId: 'tbtc--0',
      account: { address: 'tb1p-input', path: "m/86'/1'/0'/0/0" },
      unsignedTx: { encodedTx },
      addressType: 'taproot',
      signOnly: true,
    });

    expect(mocks.sdk.btcSignPsbt).toHaveBeenCalledWith(
      device.connectId,
      device.deviceId,
      {
        psbt: '70736274ff0100',
        coin: 'testnet',
        useEmptyPassphrase: true,
        skipPassphraseCheck: true,
      },
    );
    expect(result).toEqual({
      rawTx: '',
      txid: '',
      encodedTx,
      psbtHex: 'signed-psbt-hex',
      finalizedPsbtHex: 'signed-psbt-hex',
    });
  });

  it('finalizes signed PSBT and returns extracted transaction when not signOnly', async () => {
    const device = makeDevice();
    const signedTxHex = makeSignedTxHex();
    const finalizeInput = jest.fn();
    const extractTransaction = jest.fn(() => Transaction.fromHex(signedTxHex));
    const enrichToHex = jest.fn(() => 'enriched-psbt-hex');
    const finalizeToHex = jest.fn(() => 'finalized-psbt-hex');
    const updateInput = jest.fn();
    getPsbtFromHexMock()
      .mockReturnValueOnce({
        // pre-sign PSBT (enriched with derivations before SDK call)
        updateInput,
        toHex: enrichToHex,
        txOutputs: [],
      })
      .mockReturnValueOnce({
        // post-sign PSBT used for finalize/extract
        finalizeInput,
        extractTransaction,
        toHex: finalizeToHex,
      });
    const { deps, mocks } = makeDeps();
    const signer = new SignerHardware({
      impl: 'tbtc',
      device,
      passphraseMode: 'none',
      deps,
    });
    const encodedTx = {
      psbtHex: '70736274ff0100',
      inputsToSign: [
        {
          index: 0,
          publicKey:
            '03098891dd952dd6f6bde1489761d0befbfa31815e9c0e64058d12b83de852a18c',
          address: 'tb1p-input',
        },
        {
          index: 2,
          publicKey:
            '03098891dd952dd6f6bde1489761d0befbfa31815e9c0e64058d12b83de852a18c',
          address: 'tb1p-input',
        },
      ],
    };

    const result = await signer.signTransaction({
      networkId: 'tbtc--0',
      account: { address: 'tb1p-input', path: "m/86'/1'/0'/0/0" },
      unsignedTx: { encodedTx },
      addressType: 'taproot',
    });

    expect(getPsbtFromHexMock()).toHaveBeenCalledWith('70736274ff0100', {
      network: expect.objectContaining({
        networkChainCode: 'tbtc',
      }),
    });
    expect(updateInput).toHaveBeenCalledTimes(2);
    expect(updateInput).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        tapBip32Derivation: [
          expect.objectContaining({
            path: "m/86'/1'/0'/0/0",
            leafHashes: [],
          }),
        ],
      }),
    );
    expect(mocks.sdk.btcSignPsbt).toHaveBeenCalledWith(
      device.connectId,
      device.deviceId,
      expect.objectContaining({ psbt: 'enriched-psbt-hex', coin: 'testnet' }),
    );
    expect(getPsbtFromHexMock()).toHaveBeenCalledWith('signed-psbt-hex', {
      network: expect.objectContaining({
        networkChainCode: 'tbtc',
      }),
    });
    expect(finalizeInput).toHaveBeenCalledWith(0);
    expect(finalizeInput).toHaveBeenCalledWith(2);
    expect(extractTransaction).toHaveBeenCalled();
    expect(result).toEqual({
      rawTx: signedTxHex,
      txid: Transaction.fromHex(signedTxHex).getId(),
      encodedTx,
      psbtHex: 'signed-psbt-hex',
      finalizedPsbtHex: 'finalized-psbt-hex',
    });
  });

  it('rejects non-signOnly PSBT signing without inputsToSign', async () => {
    const { deps } = makeDeps();
    const signer = new SignerHardware({
      impl: 'tbtc',
      device: makeDevice(),
      passphraseMode: 'none',
      deps,
    });

    await expect(
      signer.signTransaction({
        networkId: 'tbtc--0',
        account: { address: 'tb1p-input', path: "m/86'/1'/0'/0/0" },
        unsignedTx: { encodedTx: { psbtHex: '70736274ff0100' } },
      }),
    ).rejects.toMatchObject({
      code: expect.any(String),
      message: expect.stringMatching(/inputsToSign/),
    });
  });

  it('rejects message signing with structured AppError', async () => {
    const { deps } = makeDeps();
    const signer = new SignerHardware({
      impl: 'btc',
      device: makeDevice(),
      passphraseMode: 'none',
      deps,
    });

    await expect(signer.signMessage({} as never)).rejects.toMatchObject({
      code: expect.any(String),
      message: expect.stringMatching(/BTC message signing is not exposed/),
    });
  });
});
