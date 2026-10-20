/* eslint-disable import/first */
jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IZcashTxDetails } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import Vault from '@onekeyhq/kit-bg/src/vaults/impls/zcash/Vault';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxStatus,
} from '@onekeyhq/shared/types/history';
import type { IOnChainHistoryTx } from '@onekeyhq/shared/types/history';

const txid = 'synthetic-own-withdrawal';
const accountId = 'synthetic-selected-account';
const own = 'synthetic-own-transparent-address';

function createFixture(
  hasLocalTransparentOutput: boolean,
  options?: {
    localDetails?: IZcashTxDetails;
    publicInputs?: IOnChainHistoryTx['sends'];
    publicOutputs?: IOnChainHistoryTx['receives'];
    publicStatus?: IOnChainHistoryTx['status'];
    publicBlock?: number;
    publicConfirmations?: number;
  },
) {
  const publicDetail = jest.fn(async () => ({
    data: {
      data: {
        data: {
          tx: txid,
          status: options?.publicStatus ?? 'success',
          block: options?.publicBlock,
          confirmations: options?.publicConfirmations,
          sends: options?.publicInputs,
          receives: options?.publicOutputs ?? [
            { address: own, amount: '1', isOwn: true },
          ],
        },
      },
    },
  }));
  const vault: Vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId,
    networkId: 'zec--0',
    backgroundApi: {
      simpleDb: {
        zcash: {
          getPrivacyModeState: async () => ({ intent: 'on' }),
        },
      },
      // Our transparent address is the one Receive displays.
      servicePrivacyChain: {
        getLocalWalletAccountAddresses: async () => ({ publicAddress: own }),
      },
    },
    zcashGetWalletAccount: async () => ({
      network: 'main',
      ufvk: 'synthetic-ufvk',
    }),
    zcashGetApi: async () => ({
      getSyncProgress: async () => ({ chainTip: 110 }),
      getHistory: async () => [
        {
          txid,
          minedHeight: 100,
          timestamp: 1_700_000_000,
          valueZat: '100000000',
          fee: options?.localDetails?.feeZat ?? null,
          pending: false,
          expired: false,
          txType: 'shielded',
          recipient: own,
          poolIds: [0, 4],
          perPoolBalanceDeltaZat: { '0': '100000000', '4': '-100020000' },
        },
      ],
      getTxDetails: async () =>
        options?.localDetails ?? {
          spent: [{ value: '100020000', pool: 'ironwood', address: null }],
          received: [
            {
              value: '40000000',
              pool: 'ironwood',
              address: null,
              internal: true,
              memo: null,
              memoBinary: null,
            },
            ...(hasLocalTransparentOutput
              ? [
                  {
                    value: '100000000',
                    pool: 'transparent',
                    address: own,
                    internal: false,
                    memo: null,
                    memoBinary: null,
                  },
                ]
              : []),
          ],
          external: [],
          feeZat: null,
        },
    }),
    // This fixture represents a public detail after the existing account-association guard.
    zcashFetchBackendHistoryDetail: publicDetail,
  });
  return { vault, publicDetail };
}

it('a mixed withdrawal raw detail does not silently present an empty output list when local scan facts lack its public output', async () => {
  const { vault, publicDetail } = createFixture(false);
  const response = await vault.fetchAccountHistoryDetail({
    accountId,
    networkId: 'zec--0',
    txid,
  });
  expect(publicDetail).toHaveBeenCalledTimes(1);
  expect(response.data.data.data.receives).toEqual([
    expect.objectContaining({ address: own, amount: '1' }),
  ]);
  expect(response.data.data.data).toMatchObject({
    block: 100,
    confirmations: 11,
    timestamp: 1_700_000_000,
  });
});

it('supplements a shielding transaction’s transparent inputs while keeping decrypted private outputs', async () => {
  const { vault } = createFixture(false, {
    publicInputs: [
      {
        type: EOnChainHistoryTransferType.Transfer,
        address: own,
        amount: '1.00015',
        token: '',
        key: '',
        isOwn: true,
        from: own,
        to: '',
        label: '',
      },
    ],
    publicOutputs: [],
    localDetails: {
      spent: [],
      received: [
        {
          value: '100000000',
          pool: 'ironwood',
          address: null,
          internal: false,
          memo: 'received memo',
          memoBinary: null,
        },
      ],
      external: [],
      feeZat: null,
    },
  });
  const response = await vault.fetchAccountHistoryDetail({
    accountId,
    networkId: 'zec--0',
    txid,
  });
  expect(response.data.data.data.sends).toEqual([
    expect.objectContaining({ address: own, amount: '1.00015' }),
  ]);
  expect(response.data.data.data.receives).toEqual([
    expect.objectContaining({
      amount: '1',
      type: EOnChainHistoryTransferType.Shielded,
    }),
  ]);
  expect(response.data.data.data.memo).toBe('received memo');
  expect(response.data.data.data.inputOutputSource).toBe('account');
});

it('a mixed transaction retains its private external recipient without duplicating the public output', async () => {
  const { vault } = createFixture(true, {
    localDetails: {
      spent: [{ value: '200020000', pool: 'ironwood', address: null }],
      received: [],
      external: [
        {
          value: '100000000',
          pool: 'ironwood',
          address: 'synthetic-private-recipient',
        },
        { value: '100000000', pool: 'transparent', address: own },
      ],
      feeZat: '20000',
    },
  });
  const response = await vault.fetchAccountHistoryDetail({
    accountId,
    networkId: 'zec--0',
    txid,
  });
  expect(response.data.data.data.receives).toEqual([
    expect.objectContaining({
      address: 'synthetic-private-recipient',
      amount: '1',
      type: EOnChainHistoryTransferType.Shielded,
    }),
    expect.objectContaining({ address: own, amount: '1' }),
  ]);
});

it('keeps known local facts and marks account scope when the public source is unavailable', async () => {
  const { vault, publicDetail } = createFixture(true);
  publicDetail.mockRejectedValue(new OneKeyLocalError('indexer unavailable'));
  const response = await vault.fetchAccountHistoryDetail({
    accountId,
    networkId: 'zec--0',
    txid,
  });
  expect(response.data.data.data.receives).toEqual([
    expect.objectContaining({ address: own, amount: '1' }),
  ]);
  expect(response.data.data.data.inputOutputSource).toBe('account');
});

it('a withdrawal whose public output is present locally keeps its output amount and ownership', async () => {
  const { vault } = createFixture(true);
  const response = await vault.fetchAccountHistoryDetail({
    accountId,
    networkId: 'zec--0',
    txid,
  });
  expect(response.data.data.data.receives).toEqual([
    expect.objectContaining({ address: own, amount: '1', isOwn: true }),
  ]);
});

it('includes known change only in wallet I/O and preserves the selected private pool status', async () => {
  const { vault, publicDetail } = createFixture(true, {
    publicStatus: EOnChainHistoryTxStatus.Failed,
    publicBlock: 0,
    publicConfirmations: 999,
    localDetails: {
      spent: [{ value: '140020000', pool: 'ironwood', address: null }],
      received: [
        {
          value: '40000000',
          pool: 'ironwood',
          address: null,
          internal: true,
          memo: 'change must not become a payment memo',
          memoBinary: null,
        },
      ],
      external: [{ value: '100000000', pool: 'transparent', address: own }],
      feeZat: '20000',
    },
  });
  const request = {
    accountId,
    networkId: 'zec--0',
    txid,
    privacyChainPoolId: 4,
  };
  const payment = (await vault.fetchAccountHistoryDetail(request)).data.data
    .data;
  expect(payment.receives).toHaveLength(1);
  expect(payment.receives?.[0]).toMatchObject({ amount: '1', isOwn: false });
  expect(publicDetail).not.toHaveBeenCalled();
  const io = (
    await vault.fetchAccountHistoryDetail({ ...request, withUTXOs: true })
  ).data.data.data;
  expect(io.status).toBe(EOnChainHistoryTxStatus.Success);
  expect(io.block).toBe(100);
  expect(io.confirmations).toBe(11);
  expect(io.inputOutputSource).toBe('account');
  expect(io.receives).toEqual([
    expect.objectContaining({
      amount: '0.4',
      address: '',
      label: '',
      poolId: 4,
      isChange: true,
      type: EOnChainHistoryTransferType.Shielded,
    }),
    expect.objectContaining({ amount: '1', address: own }),
  ]);
  expect(io.sends?.[0].amount).toBe('1.4002');
  expect(io.gasFee).toBe('0.0002');
  expect(io.memo).toBeUndefined();
  expect(publicDetail).toHaveBeenCalledTimes(1);
});

it('keeps an incoming shielded note without inventing its sender', async () => {
  const { vault, publicDetail } = createFixture(false, {
    localDetails: {
      spent: [],
      received: [
        {
          value: '100000000',
          pool: 'ironwood',
          address: null,
          internal: false,
          memo: 'recipient memo',
          memoBinary: { hex: 'ab'.repeat(512), hash: 'cd'.repeat(32) },
        },
      ],
      external: [],
      feeZat: null,
    },
  });
  const io = (
    await vault.fetchAccountHistoryDetail({
      accountId,
      networkId: 'zec--0',
      txid,
      privacyChainPoolId: 4,
    })
  ).data.data.data;
  expect(io.sends).toEqual([]);
  expect(io.receives?.[0]).toMatchObject({
    amount: '1',
    from: '',
    to: '',
    isOwn: true,
    isChange: false,
    address: '',
    label: '',
    poolId: 4,
  });
  expect(io.memo).toBe('recipient memo');
  expect(io.binaryMemos).toEqual([
    { hex: 'ab'.repeat(512), hash: 'cd'.repeat(32) },
  ]);
  expect(publicDetail).not.toHaveBeenCalled();
});

it.each([false, true])(
  'retains known transparent change without guessing between equal outputs (ambiguous: %s)',
  async (ambiguous) => {
    const { vault } = createFixture(false, {
      publicOutputs: [
        { address: own, amount: '0.4', isOwn: true },
        ...(ambiguous ? [{ address: own, amount: '0.4', isOwn: true }] : []),
      ] as IOnChainHistoryTx['receives'],
      localDetails: {
        spent: [{ value: '80020000', pool: 'ironwood', address: null }],
        received: [
          {
            value: '40000000',
            pool: 'transparent',
            address: own,
            internal: true,
            memo: null,
            memoBinary: null,
          },
        ],
        external: [],
        feeZat: '20000',
      },
    });
    const io = (
      await vault.fetchAccountHistoryDetail({
        accountId,
        networkId: 'zec--0',
        txid,
        privacyChainPoolId: 4,
        withUTXOs: true,
      })
    ).data.data.data;
    expect(io.receives).toHaveLength(ambiguous ? 2 : 1);
    expect(io.receives?.[0].isChange).toBe(ambiguous ? undefined : true);
  },
);
