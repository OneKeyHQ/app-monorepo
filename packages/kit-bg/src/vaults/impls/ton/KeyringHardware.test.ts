import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  Address,
  Cell,
  beginCell,
  loadMessage,
  loadMessageRelaxed,
  storeCommonMessageInfoRelaxed,
  storeStateInit,
} from '@ton/core';
import TonWeb from 'tonweb';

import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import type { ISignTransactionParams } from '@onekeyhq/kit-bg/src/vaults/types';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import firmwareClassicSigningHashes from './fixtures/firmware-classic-signing-hashes.json';
import firmwareProSigningMessages from './fixtures/firmware-pro-signing-messages.json';
import firmwareTouchSigningMessages from './fixtures/firmware-touch-signing-messages.json';
import { KeyringHardware } from './KeyringHardware';
import { createNormalizedWalletTransfer } from './sdkTon/BodyNormalizer';
import { decodePayload, encodeDecodedJetton } from './sdkTon/payload';
import { getTonHardwareSdkTransaction } from './sdkTon/transactionParser';
import { serializeUnsignedTransaction } from './sdkTon/utils';

import type { IWallet } from './sdkTon/utils';
import type { TonSignMessageParams } from '@onekeyfe/hd-core';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/errors/utils/deviceErrorUtils', () => ({
  convertDeviceResponse: jest.fn(async (call: () => Promise<unknown>) =>
    call(),
  ),
}));

const FROM = `0:${'11'.repeat(32)}`;
const RECIPIENT = `0:${'22'.repeat(32)}`;
const WALLET = `0:${'44'.repeat(32)}`;
const MASTER = `0:${'55'.repeat(32)}`;
const PUBLIC_KEY = '01'.repeat(32);
const EXPIRY = 2_000_000_000;

function friendly(address: string) {
  return Address.parse(address).toString({ bounceable: false });
}

function transaction(queryId = '0'): IEncodedTxTon {
  return {
    from: friendly(FROM),
    sequenceNo: 7,
    validUntil: EXPIRY,
    messages: [
      {
        address: friendly(WALLET),
        amount: '50000000',
        sendMode: 3,
        payload: encodeDecodedJetton(
          {
            queryId,
            amount: '1500000',
            toAddress: RECIPIENT,
            responseAddress: FROM,
            forwardAmount: '0',
            forwardPayload: beginCell().endCell(),
          },
          false,
        )
          .toBoc()
          .toString('base64'),
      },
    ],
  };
}

function setup(
  encodedTx: IEncodedTxTon,
  response: 'pro' | 'classic' | 'tampered' | 'unknownHash' = 'pro',
  returnedMessage?: string,
) {
  const contract = new TonWeb.Wallets.all.v4R2(
    new TonWeb.HttpProvider('https://rpc.invalid'),
    {
      publicKey: Buffer.from(PUBLIC_KEY, 'hex'),
      wc: 0,
    },
  ) as unknown as IWallet;
  const tonSignMessage = jest.fn(
    async (
      _connectId: string,
      _deviceId: string,
      options: TonSignMessageParams,
    ) => {
      if (returnedMessage) {
        return {
          signature: '11'.repeat(64),
          skip_validate: false,
          signing_message: returnedMessage,
        };
      }
      const returnedTx =
        response === 'tampered'
          ? {
              ...encodedTx,
              messages: [
                {
                  ...encodedTx.messages[0],
                  payload: encodeDecodedJetton({
                    queryId: '0',
                    amount: '1500000',
                    toAddress: FROM,
                    responseAddress: FROM,
                    forwardAmount: '0',
                    forwardPayload: beginCell().endCell(),
                  })
                    .toBoc()
                    .toString('base64'),
                },
              ],
            }
          : getTonHardwareSdkTransaction(encodedTx);
      const { signingMessage } =
        response === 'classic'
          ? await createNormalizedWalletTransfer(contract, returnedTx, {
              walletId: 698_983_191,
            })
          : await serializeUnsignedTransaction({
              contract,
              encodedTx: returnedTx,
              timeout: Number(options.expireAt),
              sendMode: options.mode,
            });
      let signing_message = signingMessage.toBoc().toString('hex');
      if (response === 'classic') {
        signing_message = signingMessage.hash().toString('hex');
      } else if (response === 'unknownHash') {
        signing_message = 'ff'.repeat(32);
      }
      return {
        signature: '11'.repeat(64),
        skip_validate: response === 'classic' || response === 'unknownHash',
        signing_message,
      };
    },
  );
  const keyring = Object.assign(Object.create(KeyringHardware.prototype), {
    vault: {
      networkId: 'ton--mainnet',
      backgroundApi: {},
      getAccount: jest.fn().mockResolvedValue({
        id: "hw-test--m/44'/607'/0'--v4R2",
        path: "m/44'/607'/0'",
        pub: PUBLIC_KEY,
      }),
    },
    getHardwareSDKInstance: jest.fn().mockResolvedValue({ tonSignMessage }),
  }) as KeyringHardware;
  const getData = jest
    .spyOn(TonWeb.token.jetton.JettonWallet.prototype, 'getData')
    .mockResolvedValue({
      balance: new TonWeb.utils.BN(1_500_000),
      ownerAddress: new TonWeb.Address(FROM),
      jettonMinterAddress: new TonWeb.Address(MASTER),
      tokenWalletCode: new TonWeb.boc.Cell(),
    });
  jest
    .spyOn(TonWeb.token.jetton.JettonMinter.prototype, 'getJettonWalletAddress')
    .mockResolvedValue(new TonWeb.Address(WALLET));
  const params = {
    unsignedTx: { encodedTx },
    deviceParams: {
      dbDevice: { connectId: 'connection', deviceId: 'device' },
      deviceCommonParams: {},
    },
  } as ISignTransactionParams;
  return { keyring, params, tonSignMessage, getData };
}

beforeEach(() => {
  jest
    .spyOn(appLocale.intl, 'formatMessage')
    .mockReturnValue('Failed to sign transaction');
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('TON hardware signing uses the shared transaction parser', () => {
  it.each(
    firmwareTouchSigningMessages.versions.flatMap((version) =>
      firmwareTouchSigningMessages.fixtures.map((fixture) => ({
        ...fixture,
        version,
      })),
    ),
  )(
    'preserves Touch $version firmware assembly for $name',
    async ({ encodedTx, signingMessage, version }) => {
      jest.spyOn(deviceUtils, 'getDeviceVersion').mockResolvedValue({
        firmwareVersion: version,
        bleVersion: '',
        bootloaderVersion: '',
      });
      const { keyring, params, tonSignMessage } = setup(
        encodedTx,
        'pro',
        signingMessage,
      );
      checkIsDefined(params.deviceParams).dbDevice.deviceType =
        EDeviceType.Touch;
      const signed = await keyring.signTransaction(params);
      expect(tonSignMessage.mock.calls[0][2].initState).toBe(
        Buffer.from(encodedTx.messages[0].stateInit ?? '', 'base64').toString(
          'hex',
        ),
      );
      expect(tonSignMessage.mock.calls[0][2].signingMessageRepr).toBeDefined();
      const actual = signed.encodedTx as IEncodedTxTon;
      expect(actual.messages.every((message) => !message.stateInit)).toBe(true);
      expect(actual.messages).toHaveLength(encodedTx.messages.length);
      const external = loadMessage(Cell.fromBase64(signed.rawTx).beginParse());
      const body = external.body.beginParse();
      body.loadBuffer(64);
      expect(body.asCell().hash()).toEqual(Cell.fromHex(signingMessage).hash());
    },
  );

  it.each([
    EDeviceType.Pro,
    EDeviceType.Pro2,
    EDeviceType.Neo,
    EDeviceType.Touch,
  ])(
    'does not accept an unexplained missing StateInit from %s',
    async (deviceType) => {
      jest.spyOn(deviceUtils, 'getDeviceVersion').mockResolvedValue({
        firmwareVersion: '4.13.0',
        bleVersion: '',
        bootloaderVersion: '',
      });
      const fixture = firmwareTouchSigningMessages.fixtures[0];
      const { keyring, params } = setup(
        fixture.encodedTx,
        'pro',
        fixture.signingMessage,
      );
      checkIsDefined(params.deviceParams).dbDevice.deviceType = deviceType;
      await expect(keyring.signTransaction(params)).rejects.toThrow();
    },
  );

  it.each([EDeviceType.Pro, EDeviceType.Pro2, EDeviceType.Neo])(
    'accepts the frozen SDK batch request with first-message StateInit when %s returns it',
    async (deviceType) => {
      const encodedTx = firmwareTouchSigningMessages.fixtures[1].encodedTx;
      const contract = new TonWeb.Wallets.all.v4R2(
        new TonWeb.HttpProvider('https://rpc.invalid'),
        { publicKey: Buffer.from(PUBLIC_KEY, 'hex'), wc: 0 },
      ) as unknown as IWallet;
      const sdk = await serializeUnsignedTransaction({
        contract,
        encodedTx,
        fullStateInit: true,
        timeout: encodedTx.validUntil,
        sendMode: 3,
      });
      const { keyring, params } = setup(
        encodedTx,
        'pro',
        sdk.signingMessage.toBoc().toString('hex'),
      );
      checkIsDefined(params.deviceParams).dbDevice.deviceType = deviceType;
      const signed = await keyring.signTransaction(params);
      const actual = signed.encodedTx as IEncodedTxTon;
      expect(actual.messages).toHaveLength(2);
      expect(
        Cell.fromBase64(actual.messages[0].stateInit ?? '').hash(),
      ).toEqual(Cell.fromBase64(encodedTx.messages[0].stateInit ?? '').hash());
    },
  );

  it.each(firmwareClassicSigningHashes.fixtures)(
    'matches the official Classic C firmware digest for $name',
    async ({ encodedTx, sdkRequest, hash }) => {
      const { keyring, params, tonSignMessage } = setup(
        encodedTx,
        'classic',
        hash,
      );
      const signed = await keyring.signTransaction(params);
      expect(tonSignMessage.mock.calls[0][2]).toMatchObject(sdkRequest);
      const external = loadMessage(Cell.fromBase64(signed.rawTx).beginParse());
      const body = external.body.beginParse();
      body.loadBuffer(64);
      expect(body.asCell().hash().toString('hex')).toBe(hash);
    },
  );

  it.each(firmwareProSigningMessages.fixtures)(
    'accepts the official Pro firmware serialization for $name',
    async ({ encodedTx, signingMessage }) => {
      const { keyring, params } = setup(encodedTx, 'pro', signingMessage);
      const signed = await keyring.signTransaction(params);
      const external = loadMessage(Cell.fromBase64(signed.rawTx).beginParse());
      const body = external.body.beginParse();
      body.loadBuffer(64);
      expect(body.asCell().hash()).toEqual(Cell.fromHex(signingMessage).hash());
      const actual = signed.encodedTx as IEncodedTxTon;
      const receipt = Cell.fromHex(signingMessage).beginParse();
      receipt.loadUint(32);
      expect(actual.validUntil).toBe(receipt.loadUint(32));
      expect(actual.sequenceNo).toBe(receipt.loadUint(32));
      receipt.loadUint(8);
      actual.messages.forEach((message) => {
        expect(message.sendMode).toBe(receipt.loadUint(8));
        const signedMessage = loadMessageRelaxed(
          receipt.loadRef().beginParse(),
        );
        if (message.payload) {
          expect(Cell.fromBase64(message.payload).hash()).toEqual(
            signedMessage.body.hash(),
          );
        } else {
          expect(
            signedMessage.body.bits.length + signedMessage.body.refs.length,
          ).toBe(0);
        }
      });
      receipt.endParse();
    },
  );
  it.each([false, true])(
    'uses payload recipient and raw quantity with injected metadata: %s',
    async (injected) => {
      const encodedTx = transaction();
      if (injected) {
        encodedTx.messages[0].jetton = {
          toAddress: friendly(FROM),
          amount: '999999999',
          jettonMasterAddress: FROM,
          jettonWalletAddress: FROM,
          fwdFee: '99',
        };
      }
      const { keyring, params, tonSignMessage } = setup(encodedTx);
      await expect(keyring.signTransaction(params)).resolves.toMatchObject({
        encodedTx: expect.objectContaining({ validUntil: EXPIRY }),
      });
      if (!injected) {
        expect(tonSignMessage.mock.calls[0][2]).toMatchObject({
          destination: friendly(WALLET),
          isRawData: true,
          comment: Buffer.from(
            encodedTx.messages[0].payload ?? '',
            'base64',
          ).toString('hex'),
        });
        expect(tonSignMessage.mock.calls[0][2]).not.toHaveProperty(
          'jettonAmount',
        );
        return;
      }
      expect(tonSignMessage).toHaveBeenCalledWith(
        'connection',
        'device',
        expect.objectContaining({
          destination: friendly(RECIPIENT),
          jettonAmount: '1500000',
          jettonWalletAddress: friendly(WALLET),
          jettonMasterAddress: new TonWeb.Address(MASTER).toString(
            true,
            true,
            true,
          ),
          fwdFee: '0',
          expireAt: EXPIRY,
          seqno: 7,
        }),
      );
    },
  );

  it('preserves valid master metadata and structured Jetton signing', async () => {
    const encodedTx = transaction();
    encodedTx.messages[0].jetton = {
      toAddress: friendly(RECIPIENT),
      amount: '1500000',
      jettonMasterAddress: friendly(MASTER),
      jettonWalletAddress: friendly(WALLET),
      fwdFee: '0',
    };
    const { keyring, params, tonSignMessage } = setup(encodedTx);
    await keyring.signTransaction(params);
    expect(tonSignMessage).toHaveBeenCalledWith(
      'connection',
      'device',
      expect.objectContaining({
        jettonMasterAddress: friendly(MASTER),
        jettonAmount: '1500000',
      }),
    );
    expect(encodedTx.messages[0].jetton.jettonMasterAddress).toBe(
      friendly(MASTER),
    );
  });

  it('keeps the original raw signing path when token identity cannot be verified', async () => {
    const encodedTx = transaction();
    encodedTx.messages[0].jetton = {
      amount: '999999999',
      toAddress: friendly(FROM),
      jettonMasterAddress: FROM,
      jettonWalletAddress: FROM,
      fwdFee: '99',
    };
    const { keyring, params, tonSignMessage, getData } = setup(encodedTx);
    getData.mockRejectedValue(new Error('RPC unavailable'));
    const signed = await keyring.signTransaction(params);
    expect(tonSignMessage.mock.calls[0][2]).toMatchObject({
      destination: friendly(WALLET),
      comment: Buffer.from(
        encodedTx.messages[0].payload ?? '',
        'base64',
      ).toString('hex'),
      isRawData: true,
    });
    expect(tonSignMessage.mock.calls[0][2]).not.toHaveProperty(
      'jettonMasterAddress',
    );
    expect(
      decodePayload((signed.encodedTx as IEncodedTxTon).messages[0].payload)
        .jetton?.toAddress,
    ).toBe(friendly(RECIPIENT));
  });

  it.each(['', '0', '99'])(
    'sends the payload forward amount even when the metadata fee is %s',
    async (metadataFee) => {
      const encodedTx = transaction();
      const jetton = checkIsDefined(
        decodePayload(encodedTx.messages[0].payload).jetton,
      );
      jetton.forwardAmount = '1';
      jetton.forwardPayload = beginCell()
        .storeUint(0, 32)
        .storeStringTail('memo')
        .endCell();
      encodedTx.messages[0].payload = encodeDecodedJetton(jetton, false)
        .toBoc()
        .toString('base64');
      encodedTx.messages[0].jetton = {
        amount: jetton.amount,
        toAddress: friendly(RECIPIENT),
        jettonMasterAddress: friendly(MASTER),
        jettonWalletAddress: friendly(WALLET),
        fwdFee: metadataFee,
      };
      const { keyring, params, tonSignMessage } = setup(encodedTx);
      await keyring.signTransaction(params);
      expect(tonSignMessage.mock.calls[0][2]).toMatchObject({
        jettonAmount: jetton.amount,
        fwdFee: '1',
        comment: 'memo',
        isRawData: false,
      });
    },
  );

  it('keeps nonzero query IDs in the raw payload instead of reconstructing a different transfer', async () => {
    const encodedTx = transaction('42');
    const { keyring, params, tonSignMessage } = setup(encodedTx);
    await keyring.signTransaction(params);
    expect(tonSignMessage).toHaveBeenCalledWith(
      'connection',
      'device',
      expect.objectContaining({
        destination: friendly(WALLET),
        comment: Buffer.from(
          encodedTx.messages[0].payload ?? '',
          'base64',
        ).toString('hex'),
        isRawData: true,
      }),
    );
    expect(tonSignMessage.mock.calls[0][2]).not.toHaveProperty('jettonAmount');
  });

  it('uses only a matching Classic serialization candidate', async () => {
    const encodedTx = transaction();
    const { keyring, params } = setup(encodedTx, 'classic');
    await expect(keyring.signTransaction(params)).resolves.toHaveProperty(
      'rawTx',
    );
  });

  it('preserves every message when the first message in a batch is a Jetton transfer', async () => {
    const encodedTx = transaction();
    encodedTx.messages.push({
      address: friendly(RECIPIENT),
      amount: '1',
    });
    const { keyring, params, tonSignMessage } = setup(encodedTx);
    await keyring.signTransaction(params);
    expect(tonSignMessage.mock.calls[0][2]).toMatchObject({
      destination: friendly(WALLET),
      isRawData: true,
      comment: Buffer.from(
        encodedTx.messages[0].payload ?? '',
        'base64',
      ).toString('hex'),
      extDestination: [friendly(RECIPIENT)],
      extTonAmount: ['1'],
    });
    expect(tonSignMessage.mock.calls[0][2]).not.toHaveProperty('jettonAmount');
  });

  it.each([
    'zeroAmount',
    'forwardWithoutComment',
    'nullComment',
    'longComment',
  ] as const)(
    'preserves a Jetton payload that firmware cannot reconstruct: %s',
    async (kind) => {
      const encodedTx = transaction();
      const jetton = checkIsDefined(
        decodePayload(encodedTx.messages[0].payload).jetton,
      );
      if (kind === 'zeroAmount') {
        jetton.amount = '0';
      } else if (kind === 'forwardWithoutComment') {
        jetton.forwardAmount = '1';
      } else {
        jetton.forwardAmount = '1';
        jetton.forwardPayload = beginCell()
          .storeUint(0, 32)
          .storeStringTail(
            kind === 'longComment' ? 'm'.repeat(80) : 'memo\0tail',
          )
          .endCell();
      }
      const payload = encodeDecodedJetton(jetton).toBoc().toString('base64');
      encodedTx.messages[0].payload = payload;
      const { keyring, params, tonSignMessage } = setup(encodedTx);
      await keyring.signTransaction(params);
      expect(tonSignMessage.mock.calls[0][2]).toMatchObject({
        destination: friendly(WALLET),
        isRawData: true,
        comment: Buffer.from(payload, 'base64').toString('hex'),
      });
      expect(tonSignMessage.mock.calls[0][2]).not.toHaveProperty(
        'jettonAmount',
      );
    },
  );

  it.each([
    ['bocPrefix', 'b5ee9c72 memo'],
    ['nullCharacter', 'memo\0tail'],
  ])(
    'preserves a native comment that firmware would reinterpret: %s',
    async (_kind, comment) => {
      const encodedTx = transaction();
      const payload = beginCell()
        .storeUint(0, 32)
        .storeStringTail(comment)
        .endCell()
        .toBoc()
        .toString('base64');
      encodedTx.messages = [
        { address: friendly(RECIPIENT), amount: '1', payload },
      ];
      const { keyring, params, tonSignMessage } = setup(encodedTx);
      await keyring.signTransaction(params);
      expect(tonSignMessage.mock.calls[0][2]).toMatchObject({
        isRawData: true,
        comment: Buffer.from(payload, 'base64').toString('hex'),
      });
    },
  );

  it.each(['empty', 'binary', 'snake'] as const)(
    'preserves a native %s comment as raw payload',
    async (kind) => {
      const body = beginCell().storeUint(0, 32);
      if (kind === 'binary') {
        body.storeUint(0xff, 8);
      }
      if (kind === 'snake') {
        body.storeRef(beginCell().storeStringTail('memo').endCell());
      }
      const encodedTx = transaction();
      const payload = body.endCell().toBoc().toString('base64');
      encodedTx.messages = [
        { address: friendly(RECIPIENT), amount: '50000000', payload },
      ];
      const { keyring, params, tonSignMessage } = setup(encodedTx);
      await keyring.signTransaction(params);
      expect(tonSignMessage).toHaveBeenCalledWith(
        'connection',
        'device',
        expect.objectContaining({
          isRawData: true,
          comment: Buffer.from(payload, 'base64').toString('hex'),
        }),
      );
    },
  );

  it.each(['mixedModes', 'secondStateInit'] as const)(
    'preserves the existing SDK batch behavior and records its actual fields: %s',
    async (kind) => {
      const encodedTx = transaction();
      encodedTx.messages.push({
        address: friendly(RECIPIENT),
        amount: '1',
        sendMode: kind === 'mixedModes' ? 1 : 3,
      });
      if (kind === 'secondStateInit') {
        encodedTx.messages[1].stateInit = beginCell()
          .store(
            storeStateInit({
              code: beginCell().storeUint(1, 8).endCell(),
              data: beginCell().storeUint(2, 8).endCell(),
            }),
          )
          .endCell()
          .toBoc()
          .toString('base64');
      }
      const { keyring, params, tonSignMessage } = setup(encodedTx);
      const signed = await keyring.signTransaction(params);
      const actual = signed.encodedTx as IEncodedTxTon;
      expect(tonSignMessage).toHaveBeenCalledTimes(1);
      expect(actual.messages.map((message) => message.sendMode)).toEqual([
        3, 3,
      ]);
      expect(actual.messages[1].stateInit).toBeUndefined();
    },
  );

  it.each(['tampered', 'unknownHash'] as const)(
    'rejects a hardware response that cannot prove the confirmed transaction: %s',
    async (response) => {
      const { keyring, params, tonSignMessage } = setup(
        transaction(),
        response,
      );
      await expect(keyring.signTransaction(params)).rejects.toThrow();
      expect(tonSignMessage).toHaveBeenCalledTimes(1);
    },
  );

  it.each([0, 1])(
    'packages the signed App Cell when exotic message %s triggers a signature-only fallback',
    async (exoticIndex) => {
      jest.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
      const keyPair = TonWeb.utils.nacl.sign.keyPair();
      const publicKey = Buffer.from(keyPair.publicKey);
      const wallet = new TonWeb.Wallets.all.v4R2(
        new TonWeb.HttpProvider('https://rpc.invalid'),
        { publicKey, wc: 0 },
      );
      const contract = wallet as unknown as IWallet;
      const exotic = beginCell()
        .storeUint(1, 8)
        .storeUint(7, 8)
        .storeBuffer(Buffer.alloc(96, 1))
        .storeUint(0, 48)
        .endCell({ exotic: true });
      const stateInit = beginCell()
        .store(
          storeStateInit({
            code: beginCell().storeUint(1, 8).endCell(),
            data: beginCell().storeUint(2, 8).endCell(),
          }),
        )
        .endCell()
        .toBoc()
        .toString('base64');
      const encodedTx: IEncodedTxTon = {
        from: (await wallet.getAddress()).toString(true, true, false),
        sequenceNo: 7,
        validUntil: EXPIRY,
        messages: [
          { address: friendly(RECIPIENT), amount: '1', sendMode: 3 },
          {
            address: friendly(RECIPIENT),
            amount: '1',
            sendMode: 3,
            stateInit,
          },
        ],
      };
      encodedTx.messages[exoticIndex].payload = exotic
        .toBoc()
        .toString('base64');
      const app = await serializeUnsignedTransaction({ contract, encodedTx });
      const { keyring, params, tonSignMessage } = setup(encodedTx);
      const account = await keyring.vault.getAccount();
      jest
        .spyOn(keyring.vault, 'getAccount')
        .mockResolvedValue({ ...account, pub: publicKey.toString('hex') });
      tonSignMessage.mockImplementation(async () => ({
        signature: Buffer.from(
          TonWeb.utils.nacl.sign.detached(
            app.signingMessage.hash(),
            keyPair.secretKey,
          ),
        ).toString('hex'),
        signing_message: '',
        skip_validate: true,
      }));
      const signed = await keyring.signTransaction(params);
      expect(tonSignMessage.mock.calls[0][2].signingMessageRepr).toBe(
        Buffer.from(app.signingMessage.repr()).toString('hex'),
      );
      const external = loadMessage(Cell.fromBase64(signed.rawTx).beginParse());
      const body = external.body.beginParse();
      const signature = body.loadBuffer(64);
      const signingMessage = body.asCell();
      expect(signingMessage.hash()).toEqual(app.signingMessage.hash());
      expect(
        TonWeb.utils.nacl.sign.detached.verify(
          signingMessage.hash(),
          signature,
          publicKey,
        ),
      ).toBe(true);
      const actual = signed.encodedTx as IEncodedTxTon;
      expect(actual.messages[1].stateInit).toBe(stateInit);
      expect(
        Cell.fromBase64(actual.messages[exoticIndex].payload ?? '').hash(),
      ).toEqual(exotic.hash());
    },
  );

  it('keeps software serialization defaults and applies hardware options explicitly', async () => {
    const contract = new TonWeb.Wallets.all.v4R2(
      new TonWeb.HttpProvider('https://rpc.invalid'),
      { publicKey: Buffer.from(PUBLIC_KEY, 'hex'), wc: 0 },
    ) as unknown as IWallet;
    const encodedTx = transaction();
    encodedTx.messages.push({
      address: friendly(RECIPIENT),
      amount: '1',
      sendMode: 1,
    });
    encodedTx.messages[0].sendMode = 128;
    jest.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
    const software = await serializeUnsignedTransaction({
      contract,
      encodedTx,
    });
    const original = software.signingMessage.beginParse();
    original.loadUint(32);
    expect(original.loadUint(32)).toBe(1_750_000_060);
    original.loadUint(32);
    original.loadUint(8);
    expect(original.loadUint(8)).toBe(3);
    original.loadRef();
    expect(original.loadUint(8)).toBe(3);
    const { signingMessage } = await serializeUnsignedTransaction({
      contract,
      encodedTx,
      timeout: EXPIRY,
      sendMode: 1,
    });
    const slice = signingMessage.beginParse();
    slice.loadUint(32);
    expect(slice.loadUint(32)).toBe(EXPIRY);
    expect(slice.loadUint(32)).toBe(7);
    expect(slice.loadUint(8)).toBe(0);
    expect(slice.loadUint(8)).toBe(1);
    const first = loadMessageRelaxed(slice.loadRef().beginParse());
    expect(decodePayload(first.body.toBoc()).jetton?.amount).toBe('1500000');
    expect(slice.loadUint(8)).toBe(1);
    expect(Cell.fromBase64(encodedTx.messages[0].payload ?? '').hash()).toEqual(
      first.body.hash(),
    );
  });

  it('preserves legacy App StateInit bytes and separately models the complete SDK StateInit', async () => {
    const contract = new TonWeb.Wallets.all.v4R2(
      new TonWeb.HttpProvider('https://rpc.invalid'),
      { publicKey: Buffer.from(PUBLIC_KEY, 'hex'), wc: 0 },
    ) as unknown as IWallet;
    const encodedTx = transaction();
    const code = beginCell().storeUint(1, 8).endCell();
    const data = beginCell().storeUint(2, 8).endCell();
    // oxlint-disable-next-line @cspell/spellchecker
    const special = { tick: true, tock: false };
    encodedTx.messages[0].stateInit = beginCell()
      .store(storeStateInit({ code, data, splitDepth: 5, special }))
      .endCell()
      .toBoc()
      .toString('base64');
    const app = await serializeUnsignedTransaction({ contract, encodedTx });
    const sdk = await serializeUnsignedTransaction({
      contract,
      encodedTx,
      fullStateInit: true,
      timeout: EXPIRY,
    });
    const appSlice = app.signingMessage.beginParse();
    appSlice.loadBits(112);
    const appMessage = loadMessageRelaxed(appSlice.loadRef().beginParse());
    expect(appMessage.init?.splitDepth).toBeUndefined();
    expect(appMessage.init?.special).toBeUndefined();
    expect(appMessage.init?.code?.hash()).toEqual(code.hash());
    expect(appMessage.init?.data?.hash()).toEqual(data.hash());
    const sdkSlice = sdk.signingMessage.beginParse();
    sdkSlice.loadBits(112);
    const sdkMessage = loadMessageRelaxed(sdkSlice.loadRef().beginParse());
    expect(sdkMessage.init?.splitDepth).toBe(5);
    expect(sdkMessage.init?.special).toEqual(special);
    const { keyring, params } = setup(
      encodedTx,
      'pro',
      sdk.signingMessage.toBoc().toString('hex'),
    );
    await expect(keyring.signTransaction(params)).resolves.toHaveProperty(
      'rawTx',
    );
  });

  it.each([false, true])(
    'checks original SDK StateInit identity with a re-encoded response: %s',
    async (changedEncoding) => {
      const library = beginCell().storeUint(7, 8).endCell();
      const dictionary = beginCell()
        .storeBit(false)
        .storeUint((1n << 256n) - 1n, 256)
        .storeBit(false)
        .storeUint(0, 256)
        .storeBit(true)
        .storeRef(library)
        .endCell();
      const originalInit = beginCell()
        .storeBit(false)
        .storeBit(false)
        .storeMaybeRef(beginCell().storeUint(1, 8).endCell())
        .storeMaybeRef(beginCell().storeUint(2, 8).endCell())
        .storeMaybeRef(dictionary)
        .endCell();
      const encodedTx = transaction();
      encodedTx.messages = [
        {
          address: new Address(0, originalInit.hash()).toString({
            bounceable: false,
          }),
          amount: '1',
          sendMode: 3,
          stateInit: originalInit.toBoc().toString('base64'),
        },
      ];
      const contract = new TonWeb.Wallets.all.v4R2(
        new TonWeb.HttpProvider('https://rpc.invalid'),
        { publicKey: Buffer.from(PUBLIC_KEY, 'hex'), wc: 0 },
      ) as unknown as IWallet;
      const sdk = await serializeUnsignedTransaction({
        contract,
        encodedTx,
        timeout: EXPIRY,
        fullStateInit: true,
      });
      const slice = sdk.signingMessage.beginParse();
      const header = slice.loadBits(104);
      const mode = slice.loadUint(8);
      const canonicalMessage = loadMessageRelaxed(slice.loadRef().beginParse());
      const canonicalInit = beginCell()
        .store(
          storeStateInit(checkIsDefined(canonicalMessage.init ?? undefined)),
        )
        .endCell();
      expect(canonicalInit.hash()).not.toEqual(originalInit.hash());
      // Firmware retains the supplied StateInit Cell instead of re-encoding its dictionary.
      const actualMessage = beginCell()
        .store(storeCommonMessageInfoRelaxed(canonicalMessage.info))
        .storeBit(true)
        .storeBit(true)
        .storeRef(changedEncoding ? canonicalInit : originalInit)
        .storeBit(true)
        .storeRef(canonicalMessage.body)
        .endCell();
      const actualSigningMessage = beginCell()
        .storeBits(header)
        .storeUint(mode, 8)
        .storeRef(actualMessage)
        .endCell();
      const { keyring, params } = setup(
        encodedTx,
        'pro',
        actualSigningMessage.toBoc().toString('hex'),
      );
      if (changedEncoding) {
        await expect(keyring.signTransaction(params)).rejects.toThrow();
        return;
      }
      const signed = await keyring.signTransaction(params);
      const actualTx = signed.encodedTx as IEncodedTxTon;
      expect(
        Cell.fromBase64(actualTx.messages[0].stateInit ?? '').hash(),
      ).toEqual(originalInit.hash());
      const external = loadMessage(Cell.fromBase64(signed.rawTx).beginParse());
      const body = external.body.beginParse();
      body.loadBuffer(64);
      expect(body.asCell().hash()).toEqual(actualSigningMessage.hash());
    },
  );

  it('keeps an existing App-assembled StateInit path available when the complete SDK form cannot be parsed', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
    const contract = new TonWeb.Wallets.all.v4R2(
      new TonWeb.HttpProvider('https://rpc.invalid'),
      { publicKey: Buffer.from(PUBLIC_KEY, 'hex'), wc: 0 },
    ) as unknown as IWallet;
    const encodedTx = transaction();
    encodedTx.messages[0].stateInit = beginCell()
      .storeRef(beginCell().storeUint(1, 8).endCell())
      .storeRef(beginCell().storeUint(2, 8).endCell())
      .endCell()
      .toBoc()
      .toString('base64');
    const app = await serializeUnsignedTransaction({ contract, encodedTx });
    const { keyring, params, tonSignMessage } = setup(
      encodedTx,
      'classic',
      app.signingMessage.hash().toString('hex'),
    );
    await expect(keyring.signTransaction(params)).resolves.toHaveProperty(
      'rawTx',
    );
    expect(tonSignMessage.mock.calls[0][2].signingMessageRepr).toBeDefined();
  });
});
