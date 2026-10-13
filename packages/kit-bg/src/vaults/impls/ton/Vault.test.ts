import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  Address,
  Cell,
  beginCell,
  loadMessageRelaxed,
  storeStateInit,
} from '@ton/core';
import TonWeb from 'tonweb';

import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import firmwareTouchSigningMessages from './fixtures/firmware-touch-signing-messages.json';
import { encodeDecodedJetton } from './sdkTon/payload';
import { decodePayload, serializeUnsignedTransaction } from './sdkTon/utils';
import TonVault from './Vault';

import type { IWallet } from './sdkTon/utils';
import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBDevice } from '../../../dbs/local/types';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const FROM = `0:${'11'.repeat(32)}`;
const RECIPIENT = `0:${'22'.repeat(32)}`;
const FORGED_RECIPIENT = `0:${'33'.repeat(32)}`;
const JETTON_WALLET = `0:${'44'.repeat(32)}`;
const MASTER = `0:${'55'.repeat(32)}`;
const FORGED_MASTER = `0:${'66'.repeat(32)}`;

function friendly(address: string) {
  return new TonWeb.Address(address).toString(true, true, false);
}

function buildJettonTx(): IEncodedTxTon {
  const payload = beginCell()
    .storeUint(0x0f_8a_7e_a5, 32)
    .storeUint(0, 64)
    .storeCoins(1_500_000)
    .storeAddress(Address.parse(RECIPIENT))
    .storeAddress(Address.parse(FROM))
    .storeBit(false)
    .storeCoins(0)
    .storeBit(false)
    .endCell()
    .toBoc()
    .toString('base64');
  return {
    from: friendly(FROM),
    sequenceNo: 0,
    messages: [
      { address: friendly(JETTON_WALLET), amount: '50000000', payload },
    ],
  };
}

function forgeMetadata(tx: IEncodedTxTon) {
  tx.messages[0].jetton = {
    amount: '999999999',
    toAddress: friendly(FORGED_RECIPIENT),
    jettonMasterAddress: FORGED_MASTER,
    jettonWalletAddress: friendly(JETTON_WALLET),
    fwdFee: '0',
  };
}

function setup() {
  const vault = Object.create(TonVault.prototype) as TonVault;
  vault.networkId = 'ton--mainnet';
  vault.accountId = 'test-account';
  vault.getAccountAddress = jest.fn().mockResolvedValue(friendly(FROM));
  vault.getNetwork = jest.fn().mockResolvedValue({
    id: vault.networkId,
    decimals: 9,
    symbol: 'TON',
  });
  const getToken = jest
    .fn<Promise<IToken | null>, [{ tokenIdOnNetwork: string }]>()
    .mockImplementation(
      async ({ tokenIdOnNetwork }: { tokenIdOnNetwork: string }) => ({
        address: tokenIdOnNetwork,
        decimals: tokenIdOnNetwork ? 6 : 9,
        symbol: tokenIdOnNetwork ? 'JETTON' : 'TON',
        name: tokenIdOnNetwork ? 'Jetton' : 'Toncoin',
        isNative: !tokenIdOnNetwork,
      }),
    );
  vault.backgroundApi = {
    serviceToken: { getToken },
    serviceAccount: {
      getAccountDeviceSafe: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as IBackgroundApi;
  const getData = jest
    .spyOn(TonWeb.token.jetton.JettonWallet.prototype, 'getData')
    .mockResolvedValue({
      balance: new TonWeb.utils.BN(1_500_000),
      ownerAddress: new TonWeb.Address(FROM),
      jettonMinterAddress: new TonWeb.Address(MASTER),
      tokenWalletCode: new TonWeb.boc.Cell(),
    });
  const getWalletAddress = jest
    .spyOn(TonWeb.token.jetton.JettonMinter.prototype, 'getJettonWalletAddress')
    .mockResolvedValue(new TonWeb.Address(JETTON_WALLET));
  return { vault, getToken, getData, getWalletAddress };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TON Jetton confirmation integrity', () => {
  it.each(firmwareTouchSigningMessages.fixtures)(
    'uses the same Touch projection for confirmation of $name',
    async ({ encodedTx }) => {
      const { vault } = setup();
      vault.accountId = "hw-test--m/44'/607'/0'--v4R2";
      const getDevice = jest.spyOn(
        vault.backgroundApi.serviceAccount,
        'getAccountDeviceSafe',
      );
      const device: IDBDevice = {
        id: 'touch-test',
        name: 'Touch',
        features: '',
        connectId: 'connection',
        uuid: 'touch-test',
        deviceId: 'device',
        deviceType: EDeviceType.Touch,
        settingsRaw: '',
        createdAt: 0,
        updatedAt: 0,
      };
      getDevice.mockResolvedValue(device);
      jest.spyOn(deviceUtils, 'getDeviceVersion').mockResolvedValue({
        firmwareVersion: '4.12.0',
        bleVersion: '',
        bootloaderVersion: '',
      });
      const decoded = await vault.buildDecodedTx({ unsignedTx: { encodedTx } });
      const actual = decoded.encodedTx as IEncodedTxTon;
      expect(actual.messages.every((message) => !message.stateInit)).toBe(true);
      expect(encodedTx.messages[0].stateInit).toBeDefined();
      getDevice.mockClear();
      await vault.buildDecodedTx({
        unsignedTx: { encodedTx: actual },
        saveToLocalHistory: true,
      });
      expect(getDevice).not.toHaveBeenCalled();
    },
  );

  it.each([0, 1])(
    'preserves the App confirmation input when message %s requires an exotic fallback',
    async (exoticIndex) => {
      const { vault } = setup();
      vault.accountId = "hw-test--m/44'/607'/0'--v4R2";
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
        from: friendly(FROM),
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
      const decoded = await vault.buildDecodedTx({ unsignedTx: { encodedTx } });
      expect((decoded.encodedTx as IEncodedTxTon).messages[1].stateInit).toBe(
        stateInit,
      );
    },
  );

  it('sends only signing fields to server parsing while retaining local hardware metadata', async () => {
    const { vault } = setup();
    const encodedTx = buildJettonTx();
    forgeMetadata(encodedTx);
    const originalMetadata = encodedTx.messages[0].jetton;
    const parsed = await vault.buildParseTransactionParams({ encodedTx });
    const transaction = parsed.encodedTx as IEncodedTxTon;
    expect(transaction.messages[0]).not.toHaveProperty('jetton');
    expect(transaction.messages[0].payload).toBe(encodedTx.messages[0].payload);
    expect(encodedTx.messages[0].jetton).toBe(originalMetadata);
  });
  it.each([false, true])(
    'uses the signed payload and verified master with forged metadata: %s',
    async (withForgedMetadata) => {
      const { vault, getToken, getData, getWalletAddress } = setup();
      const encodedTx = buildJettonTx();
      if (withForgedMetadata) {
        forgeMetadata(encodedTx);
      }
      const decodedTx = await vault.buildDecodedTx({
        unsignedTx: { encodedTx },
      });
      expect(decodedTx.actions[0].assetTransfer).toMatchObject({
        to: friendly(RECIPIENT),
        sends: [
          {
            to: friendly(RECIPIENT),
            amount: '1.5',
            isNative: false,
            tokenIdOnNetwork: MASTER,
          },
        ],
      });
      expect(getData).toHaveBeenCalledTimes(1);
      expect(getWalletAddress).toHaveBeenCalledTimes(1);
      expect(getToken).toHaveBeenCalledWith(
        expect.objectContaining({ tokenIdOnNetwork: MASTER }),
      );
      expect(decodedTx.encodedTx).toBe(encodedTx);
    },
  );

  it('keeps native transfers native despite injected Jetton metadata', async () => {
    const { vault, getToken, getData } = setup();
    const encodedTx: IEncodedTxTon = {
      from: friendly(FROM),
      messages: [{ address: friendly(RECIPIENT), amount: '50000000' }],
    };
    forgeMetadata(encodedTx);
    const decodedTx = await vault.buildDecodedTx({ unsignedTx: { encodedTx } });
    expect(decodedTx.actions[0].assetTransfer).toMatchObject({
      to: friendly(RECIPIENT),
      sends: [{ amount: '0.05', isNative: true, tokenIdOnNetwork: '' }],
    });
    expect(getData).not.toHaveBeenCalled();
    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdOnNetwork: '' }),
    );
  });

  it('keeps native units accurate when cached token metadata is unavailable', async () => {
    const { vault, getToken } = setup();
    getToken.mockResolvedValue(null);
    const encodedTx: IEncodedTxTon = {
      from: friendly(FROM),
      messages: [{ address: friendly(RECIPIENT), amount: '50000000' }],
    };
    const decoded = await vault.buildDecodedTx({ unsignedTx: { encodedTx } });
    expect(decoded.actions[0].assetTransfer?.sends[0]).toMatchObject({
      amount: '0.05',
      symbol: 'TON',
      isNative: true,
    });
  });

  it('does not present Jetton raw units as a known token amount without metadata', async () => {
    const { vault, getToken } = setup();
    getToken.mockResolvedValue(null);
    const decoded = await vault.buildDecodedTx({
      unsignedTx: { encodedTx: buildJettonTx() },
    });
    expect(decoded.actions[0].type).toBe(EDecodedTxActionType.UNKNOWN);
  });

  it.each([undefined, '2'])(
    'preserves wallet-built Jetton transfers and the confirmed multiplier: %s',
    async (balanceMultiplier) => {
      const { vault, getToken } = setup();
      const tokenInfo: IToken = {
        address: friendly(MASTER),
        decimals: 6,
        symbol: 'JETTON',
        name: 'Jetton',
        isNative: false,
        balanceMultiplier,
      };
      getToken.mockResolvedValue({ ...tokenInfo, balanceMultiplier: '7' });
      const encodedTx = (await vault.buildEncodedTx({
        transfersInfo: [
          {
            from: friendly(FROM),
            to: friendly(RECIPIENT),
            amount: '1.5',
            tokenInfo,
          },
        ],
      })) as IEncodedTxTon;
      expect(encodedTx.messages[0].jetton).toMatchObject({
        toAddress: friendly(RECIPIENT),
        amount: '1500000',
        jettonMasterAddress: tokenInfo.address,
      });
      const decodedTx = await vault.buildDecodedTx({
        unsignedTx: { encodedTx },
        transferPayload: {
          amountToSend: balanceMultiplier ? '3' : '1.5',
          isMaxSend: false,
          isNFT: false,
          originalRecipient: friendly(RECIPIENT),
          tokenInfo,
        },
      });
      expect(decodedTx.actions[0].assetTransfer).toMatchObject({
        to: friendly(RECIPIENT),
        sends: [{ amount: balanceMultiplier ? '3' : '1.5', isNative: false }],
      });
    },
  );

  it('does not fall back to forged token metadata when the lookup fails', async () => {
    const { vault, getData, getToken } = setup();
    getData.mockRejectedValue(new Error('RPC unavailable'));
    const encodedTx = buildJettonTx();
    forgeMetadata(encodedTx);
    const decoded = await vault.buildDecodedTx({ unsignedTx: { encodedTx } });
    expect(decoded.actions[0].type).toBe(EDecodedTxActionType.UNKNOWN);
    expect(decoded.actions[0].assetTransfer).toBeUndefined();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('reuses background-verified facts when the signed payload uses a different Either layout', async () => {
    const { vault, getData, getWalletAddress } = setup();
    const original = buildJettonTx();
    forgeMetadata(original);
    await vault.buildDecodedTx({ unsignedTx: { encodedTx: original } });
    getData.mockRejectedValue(new Error('RPC unavailable after signing'));
    getWalletAddress.mockRejectedValue(
      new Error('RPC unavailable after signing'),
    );
    const decoded = checkIsDefined(
      decodePayload(original.messages[0].payload).jetton,
    );
    const signed: IEncodedTxTon = {
      ...original,
      messages: [
        {
          ...original.messages[0],
          jetton: undefined,
          payload: encodeDecodedJetton(decoded, true)
            .toBoc()
            .toString('base64'),
        },
      ],
    };
    const history = await vault.buildDecodedTx({
      unsignedTx: { encodedTx: signed },
      saveToLocalHistory: true,
    });
    expect(history.actions[0].assetTransfer?.to).toBe(friendly(RECIPIENT));
    expect(getData).toHaveBeenCalledTimes(1);
    expect(getWalletAddress).toHaveBeenCalledTimes(1);
    expect(history.encodedTx).toBe(signed);
  });

  it('does not reuse a verification snapshot for another signed payload', async () => {
    const { vault, getData } = setup();
    const original = buildJettonTx();
    await vault.buildDecodedTx({ unsignedTx: { encodedTx: original } });
    getData.mockRejectedValue(new Error('RPC unavailable'));
    const decoded = checkIsDefined(
      decodePayload(original.messages[0].payload).jetton,
    );
    const changed: IEncodedTxTon = {
      ...original,
      messages: [
        {
          ...original.messages[0],
          payload: encodeDecodedJetton({
            ...decoded,
            toAddress: FORGED_RECIPIENT,
          })
            .toBoc()
            .toString('base64'),
        },
      ],
    };
    const history = await vault.buildDecodedTx({
      unsignedTx: { encodedTx: changed },
      saveToLocalHistory: true,
    });
    expect(history.actions[0].type).toBe(EDecodedTxActionType.UNKNOWN);
    expect(getData).toHaveBeenCalledTimes(2);
  });

  it('does not claim a token transfer when its master resolves to a different wallet', async () => {
    const { vault, getWalletAddress, getToken } = setup();
    getWalletAddress.mockResolvedValue(new TonWeb.Address(FORGED_MASTER));
    const decoded = await vault.buildDecodedTx({
      unsignedTx: { encodedTx: buildJettonTx() },
    });
    expect(decoded.actions[0].type).toBe(EDecodedTxActionType.UNKNOWN);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('preserves the real recipient and amount in the signing message', async () => {
    const encodedTx = buildJettonTx();
    const contract = new TonWeb.Wallets.all.v4R2(
      new TonWeb.HttpProvider('https://rpc.invalid'),
      {
        publicKey: new Uint8Array(32).fill(1),
        wc: 0,
      },
    ) as unknown as IWallet;
    const original = await serializeUnsignedTransaction({
      contract,
      encodedTx,
    });
    forgeMetadata(encodedTx);
    const forged = await serializeUnsignedTransaction({ contract, encodedTx });
    expect(forged.signingMessage.hash()).toEqual(
      original.signingMessage.hash(),
    );
    const message = loadMessageRelaxed(
      forged.signingMessage.refs[0].beginParse(),
    );
    expect(message.body.hash()).toEqual(
      Cell.fromBase64(encodedTx.messages[0].payload ?? '').hash(),
    );
    expect(decodePayload(message.body.toBoc())).toMatchObject({
      type: EDecodedTxActionType.ASSET_TRANSFER,
      jetton: { toAddress: friendly(RECIPIENT), amount: '1500000' },
    });
  });
});
