/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { getOnChainHistoryTxStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
} from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { mergeLocalTxDisplayFields } from '../../../services/ServiceHistory';
import VaultBtc from '../btc/Vault';

import { restoreZcashLocalTransparentPayment } from './backendHistory';
import Vault from './Vault';

import type { IEncodedTxZcash } from './types';

const txid = 'ab'.repeat(32);
const sender = 't1-sender';
const recipient = 'u1-recipient';
const params = {
  accountId: 'account',
  networkId: 'zec--0',
  accountAddress: sender,
  xpub: 'test-xpub',
};

function encoded(): IEncodedTxZcash {
  return {
    inputs: [],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    txSize: 0,
    outputs: [{ address: recipient, value: '80000' }],
    zcashMode: 'transparent',
    zcashTo: recipient,
    zcashAmountValue: '80000',
    zcashMemoHex: 'ff',
    fee: '20000',
    zcashTransparentBuild: {
      txid,
      rawTx: '00ff',
      feeZat: '20000',
      expiryHeight: 100,
      spentOutpoints: [],
    },
  };
}

function localPayment(): IAccountHistoryTx {
  return {
    id: 'local-payment',
    isLocalCreated: true,
    privacyChainHistorySide: 'public',
    privacyChainHistoryPoolIds: [0],
    decodedTx: {
      txid,
      networkId: params.networkId,
      accountId: params.accountId,
      owner: sender,
      signer: sender,
      nonce: 0,
      extraInfo: null,
      to: recipient,
      actions: [],
      status: EDecodedTxStatus.Pending,
      encodedTx: encoded(),
    },
  };
}

function backendPayment(): IOnChainHistoryTx {
  return {
    tx: txid,
    networkId: params.networkId,
    key: `${params.networkId}_`,
    riskLevel: 0,
    type: EOnChainHistoryTxType.Send,
    sends: [
      {
        type: EOnChainHistoryTransferType.Transfer,
        from: sender,
        to: '',
        token: '',
        key: `${params.networkId}_`,
        amount: '0.001',
        label: '',
        isOwn: true,
      },
    ],
    receives: [],
    from: sender,
    to: '',
    value: '0.001',
    gasFee: '',
    gasFeeFiatValue: '',
    label: '',
    status: EOnChainHistoryTxStatus.Success,
    timestamp: 2,
    block: 30,
    confirmations: 1,
    nonce: 0,
    functionCode: '',
    params: [],
  };
}

function createVault(initial = localPayment()) {
  let cached = initial ? [initial] : [];
  const raw = backendPayment();
  jest
    .spyOn(VaultBtc.prototype, 'buildOnChainHistoryTx')
    .mockImplementation(async ({ onChainHistoryTx: tx }) => ({
      id: tx.tx,
      decodedTx: {
        txid: tx.tx,
        networkId: tx.networkId,
        accountId: params.accountId,
        owner: sender,
        signer: tx.from,
        nonce: 0,
        extraInfo: null,
        to: tx.to,
        actions: [],
        status: getOnChainHistoryTxStatus(tx.status),
        nativeAmount: tx.value,
        totalFeeInNative: tx.gasFee,
        totalFeeFiatValue: tx.gasFeeFiatValue,
      },
    }));
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId: params.accountId,
    networkId: params.networkId,
    backgroundApi: {
      simpleDb: {
        zcash: {
          getAccountMeta: async () => null,
          getPrivacyModeState: async () => ({ intent: 'off' }),
          listTransparentPendingTxs: async () => [],
        },
        localHistory: {
          getAccountLocalHistoryConfirmedTxs: async () =>
            cached.filter(
              (tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending,
            ),
          getAccountLocalHistoryPendingTxs: async () =>
            cached.filter(
              (tx) => tx.decodedTx.status === EDecodedTxStatus.Pending,
            ),
          saveLocalHistoryTxs: async ({
            pendingTxs,
            confirmedTxs,
          }: {
            pendingTxs: IAccountHistoryTx[];
            confirmedTxs: IAccountHistoryTx[];
          }) => {
            cached = [...pendingTxs, ...confirmedTxs];
          },
        },
      },
      serviceToken: { getToken: async () => undefined },
      serviceAccount: {
        getDBAccountSafe: async () => ({ address: sender, xpub: params.xpub }),
      },
      serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
      serviceHistory: {
        getOneKeyIdAuthHeaders: async () => ({}),
        getClient: async () => ({
          post: async () => ({
            data: {
              data: { data: [raw], tokens: {}, nfts: {}, hasMore: false },
            },
          }),
        }),
      },
    },
    getAccount: async () => ({ address: sender }),
    baseFetchAccountHistoryDetail: async (
      _request: Parameters<Vault['baseFetchAccountHistoryDetail']>[0],
    ) => ({
      data: { data: { data: raw, tokens: {}, nfts: {} } },
    }),
  });
  const runtime = jest
    .spyOn(vault, 'zcashGetApi')
    .mockRejectedValue(
      new Error('transparent history must not initialize the wallet runtime'),
    );
  return { vault, runtime, raw, getCached: () => cached };
}

afterEach(() => {
  jest.restoreAllMocks();
});

it('retains the signed payment across confirmation, serialization and repeated refreshes', async () => {
  const { vault, runtime, getCached } = createVault();
  await vault.fetchAccountHistoryFromLocal(params);
  const saved = JSON.parse(JSON.stringify(getCached()[0])) as IAccountHistoryTx;
  const restarted = createVault(saved);
  for (const instance of [vault, restarted.vault]) {
    const rows = await instance.fetchAccountHistoryFromLocal(params);
    expect(rows?.[0].decodedTx).toMatchObject({
      status: EDecodedTxStatus.Confirmed,
      nativeAmount: '0.0008',
      totalFeeInNative: '0.0002',
      to: recipient,
      encodedTx: { zcashAmountValue: '80000', fee: '20000' },
    });
    expect(rows?.[0].decodedTx.nativeAmountIsUnknown).not.toBe(true);
    expect(rows?.[0].decodedTx.totalFeeFiatValue).toBeUndefined();
    expect(
      (rows?.[0].decodedTx.encodedTx as IEncodedTxZcash).zcashMemoHex,
    ).toBeUndefined();
  }
  expect(runtime).not.toHaveBeenCalled();
  expect(restarted.runtime).not.toHaveBeenCalled();
});

it('restores summary facts while preserving the real input/output arrays and chain status', async () => {
  const { vault, raw } = createVault();
  const summary = (await vault.fetchAccountHistoryDetail({ ...params, txid }))
    .data.data.data;
  expect(summary).toMatchObject({
    value: '0.0008',
    gasFee: '0.0002',
    to: recipient,
    block: 30,
  });
  expect(summary.receives[0]).toMatchObject({
    to: recipient,
    amount: '0.0008',
  });
  const io = (
    await vault.fetchAccountHistoryDetail({ ...params, txid, withUTXOs: true })
  ).data.data.data;
  expect(io.sends).toEqual(raw.sends);
  expect(io.receives).toEqual(raw.receives);
  expect(io.inputOutputSource).toBe('public');
  raw.status = EOnChainHistoryTxStatus.Failed;
  const failed = (await vault.fetchAccountHistoryDetail({ ...params, txid }))
    .data.data.data;
  expect(failed.status).toBe(EOnChainHistoryTxStatus.Failed);
});

it('preserves an explicit transparent self payment instead of replacing it with the fee', () => {
  const local = localPayment();
  (local.decodedTx.encodedTx as IEncodedTxZcash).zcashTo = sender;
  const tx = restoreZcashLocalTransparentPayment({
    tx: { ...backendPayment(), to: sender, value: '0.0002', gasFee: '0.0002' },
    localTx: local,
  });
  expect(tx.value).toBe('0.0008');
  expect(tx.receives).toEqual([
    expect.objectContaining({ to: sender, isOwn: true, amount: '0.0008' }),
  ]);
});

function createLegacySelfTransfer() {
  const local = localPayment();
  local.isLocalCreated = false;
  const context = createVault(local);
  Object.assign(context.raw, {
    from: sender,
    to: sender,
    value: '0.00015',
    gasFee: '0.00015',
  });
  const detail: IOnChainHistoryTx = {
    ...context.raw,
    sends: ['0.0006', '0.00035', '0.0001'].map((amount) => ({
      ...context.raw.sends[0],
      amount,
      isOwn: false,
    })),
    receives: [
      {
        ...context.raw.sends[0],
        from: '',
        to: sender,
        amount: '0.0009',
        isOwn: false,
      },
    ],
  };
  const fetchDetail = jest
    .spyOn(context.vault, 'baseFetchAccountHistoryDetail')
    .mockImplementation(async (request) => ({
      data: {
        data: {
          data: request.accountAddress ? context.raw : detail,
          tokens: {},
          nfts: {},
        },
      },
    }));
  return { ...context, detail, fetchDetail };
}

// Like BTC: a self-transfer this device did not sign shows the backend's value.
it('shows an unsigned transparent self-transfer with the backend value', async () => {
  const { vault, fetchDetail, runtime } = createLegacySelfTransfer();
  const rows = await vault.fetchAccountHistoryFromLocal(params);
  expect(rows?.[0].decodedTx).toMatchObject({
    nativeAmount: '0.00015',
    totalFeeInNative: '0.00015',
    to: sender,
    status: EDecodedTxStatus.Confirmed,
  });
  expect(rows?.[0].decodedTx.nativeAmountIsUnknown).not.toBe(true);
  expect(rows?.[0].isLocalCreated).not.toBe(true);
  expect(fetchDetail).not.toHaveBeenCalled();
  expect(runtime).not.toHaveBeenCalled();
});

it('keeps the public I/O of an unsigned self-transfer as the backend reports it', async () => {
  const { vault, detail } = createLegacySelfTransfer();
  const summary = (await vault.fetchAccountHistoryDetail({ ...params, txid }))
    .data.data.data;
  expect(summary).toMatchObject({
    value: '0.00015',
    gasFee: '0.00015',
    to: sender,
  });
  const io = (
    await vault.fetchAccountHistoryDetail({
      accountId: params.accountId,
      networkId: params.networkId,
      txid,
      withUTXOs: true,
    })
  ).data.data.data;
  expect(io.sends).toEqual(detail.sends);
  expect(io.receives).toEqual(detail.receives);
});

it('does not fetch I/O when a signed transparent self-payment is already known', async () => {
  const local = localPayment();
  (local.decodedTx.encodedTx as IEncodedTxZcash).zcashTo = sender;
  const { vault, raw } = createVault(local);
  raw.from = sender;
  raw.to = sender;
  const fetchDetail = jest.spyOn(vault, 'baseFetchAccountHistoryDetail');
  const rows = await vault.fetchAccountHistoryFromLocal(params);
  expect(rows?.[0].decodedTx.nativeAmount).toBe('0.0008');
  expect(rows?.[0].decodedTx.nativeAmountIsUnknown).not.toBe(true);
  expect(fetchDetail).not.toHaveBeenCalled();
});

it.each([
  'unsigned',
  'different transaction',
  'different network',
  'private cache',
])('does not infer a payment from %s', async (scenario) => {
  const local = localPayment();
  if (scenario === 'unsigned') local.isLocalCreated = false;
  if (scenario === 'different transaction')
    local.decodedTx.txid = 'cd'.repeat(32);
  if (scenario === 'different network') local.decodedTx.networkId = 'btc--0';
  if (scenario === 'private cache') local.privacyChainHistorySide = 'private';
  const { vault } = createVault(local);
  const rows = await vault.fetchAccountHistoryFromLocal(params);
  // Falls back to the backend's net transparent debit, as before.
  expect(rows?.[0].decodedTx.nativeAmountIsUnknown).not.toBe(true);
  expect(rows?.[0].decodedTx.nativeAmount).toBe('0.001');
  expect(rows?.[0].decodedTx.to).not.toBe(recipient);
});

it('saves signed payment fields without retaining memo plaintext or raw signed bytes', async () => {
  const { vault } = createVault();
  const row = localPayment();
  const signedEncoded = encoded();
  (row.decodedTx.encodedTx as IEncodedTxZcash).zcashTransparentBuild =
    undefined;
  (row.decodedTx.encodedTx as IEncodedTxZcash).zcashAmountValue = '100000';
  jest.spyOn(vault, 'baseBuildHistoryTx').mockResolvedValue(row);
  const saved = await vault.buildHistoryTx({
    decodedTx: row.decodedTx,
    signedTx: { txid, rawTx: '00ff', encodedTx: signedEncoded },
  });
  const stored = saved.decodedTx.encodedTx as IEncodedTxZcash;
  expect(saved.isLocalCreated).toBe(true);
  expect(stored.zcashTransparentBuild).toBeUndefined();
  expect(stored.zcashAmountValue).toBe('80000');
  expect(stored.fee).toBe('20000');
  expect(stored.zcashMemoHex).toBeUndefined();
});

it('keeps the payment and current price when an All Networks refresh replaces the row', () => {
  const local = localPayment();
  const transfer = {
    from: sender,
    to: recipient,
    amount: '0.0008',
    tokenIdOnNetwork: '',
    isNative: true,
    icon: '',
    symbol: 'ZEC',
    name: 'Zcash',
    isNFT: false,
  };
  local.decodedTx.actions = [
    {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        from: sender,
        to: recipient,
        sends: [transfer],
        receives: [],
      },
    },
  ];
  const indexed: IAccountHistoryTx = {
    ...local,
    privacyChainHistorySide: undefined,
    decodedTx: {
      ...local.decodedTx,
      status: EDecodedTxStatus.Confirmed,
      block: 30,
      nativeAmount: '0.001',
      nativeAmountIsUnknown: true,
      totalFeeInNative: undefined,
      encodedTx: undefined,
      to: 'Shielded',
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: sender,
            to: 'Shielded',
            sends: [{ ...transfer, amount: '0.001', price: '1000' }],
            receives: [],
          },
        },
      ],
    },
  };
  const merged = mergeLocalTxDisplayFields({
    localTx: local,
    onChainHistoryTx: indexed,
  });
  expect(merged.decodedTx).toMatchObject({
    nativeAmount: '0.0008',
    totalFeeInNative: '0.0002',
    nativeAmountIsUnknown: false,
    to: recipient,
    status: EDecodedTxStatus.Confirmed,
    block: 30,
  });
  expect(merged.decodedTx.actions[0].assetTransfer?.sends).toEqual([
    { ...transfer, price: '1000' },
  ]);
  expect(
    mergeLocalTxDisplayFields({ localTx: merged, onChainHistoryTx: indexed })
      .decodedTx,
  ).toEqual(merged.decodedTx);
  expect(
    mergeLocalTxDisplayFields({
      localTx: local,
      onChainHistoryTx: { ...indexed, privacyChainHistorySide: 'mixed' },
    }).decodedTx,
  ).toBe(indexed.decodedTx);
  const btc = {
    ...indexed,
    decodedTx: { ...indexed.decodedTx, networkId: 'btc--0' },
  };
  expect(
    mergeLocalTxDisplayFields({ localTx: local, onChainHistoryTx: btc })
      .decodedTx,
  ).toBe(btc.decodedTx);
});
