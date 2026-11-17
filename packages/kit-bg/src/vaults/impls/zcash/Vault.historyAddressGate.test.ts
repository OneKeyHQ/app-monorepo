/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance');
jest.mock('./vaultHistory', () => ({
  ...jest.requireActual<typeof import('./vaultHistory')>('./vaultHistory'),
  fetchAccountHistoryFromLocal: jest.fn(),
  fetchAccountHistoryDetail: jest.fn(),
}));

import fixtures from '@onekeyhq/core/src/chains/zcash/sdkZcash/unifiedAddress.fixtures.json';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTransferType } from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import Vault from './Vault';
import * as zcashHistory from './vaultHistory';

const T1 = `t1${'A'.repeat(33)}`;
const LEGACY_CHANGE = `t1${'H'.repeat(33)}`;
const DIVERSIFIED = `u1${'d'.repeat(90)}`;
const params = {
  accountId: 'account',
  networkId: 'zec--0',
  accountAddress: T1,
};

function createVault() {
  const getLocalWalletAccountAddresses = jest.fn(async () => ({
    publicAddress: T1,
    privateAddress: `u1${'q'.repeat(90)}`,
  }));
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId: params.accountId,
    networkId: params.networkId,
    backgroundApi: {
      servicePrivacyChain: { getLocalWalletAccountAddresses },
      serviceAccount: { getDBAccountSafe: async () => ({ address: T1 }) },
    },
  });
  return { vault, getLocalWalletAccountAddresses };
}

const changeRow = (id: string): IAccountHistoryTx =>
  ({
    id,
    decodedTx: {
      txid: id,
      owner: T1,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: T1,
            to: '',
            sends: [],
            receives: [{ from: T1, to: LEGACY_CHANGE, isOwn: true }],
          },
        },
      ],
    },
  }) as unknown as IAccountHistoryTx;

it('checks every history row against one read of the displayed addresses', async () => {
  const { vault, getLocalWalletAccountAddresses } = createVault();
  jest
    .mocked(zcashHistory.fetchAccountHistoryFromLocal)
    .mockResolvedValue([changeRow('a'), changeRow('b')]);
  const rows = await vault.fetchAccountHistoryFromLocal(params);
  expect(getLocalWalletAccountAddresses).toHaveBeenCalledTimes(1);
  // A transparent change address of ours shows as it is, as on BTC.
  expect(
    rows?.[0].decodedTx.actions[0].assetTransfer?.receives[0],
  ).toMatchObject({ to: LEGACY_CHANGE, isOwn: true });
});

it('checks a detail before it leaves the background', async () => {
  const { vault } = createVault();
  const detail = {
    tx: 'a',
    receives: [
      {
        type: EOnChainHistoryTransferType.Shielded,
        address: DIVERSIFIED,
        to: DIVERSIFIED,
        from: '',
        isOwn: true,
        poolId: 4,
      },
    ],
  } as unknown as IOnChainHistoryTx;
  jest.mocked(zcashHistory.fetchAccountHistoryDetail).mockResolvedValue({
    data: { data: { data: detail, tokens: {}, nfts: {} } },
  });
  const response = await vault.fetchAccountHistoryDetail({
    ...params,
    txid: 'a',
  });
  expect(response.data.data.data.receives[0]).toMatchObject({
    address: '',
    to: '',
    isOwn: true,
    poolId: 4,
  });
});

// The runtime names an own output by its address-table UA (P2PKH + Orchard); each output shows the
// displayed address of its own pool only.
describe('a detail names our side by the addresses Receive displays', () => {
  const fixture = (name: string) => {
    const found = fixtures.find((item) => item.name === name);
    if (!found) throw new OneKeyLocalError(`missing fixture ${name}`);
    return found.address;
  };
  const TABLE_UA = fixture('derived account 0 all');
  const RECEIVE_UA = fixture('derived account 0 orchard');
  // The P2PKH receiver of TABLE_UA.
  const RECEIVE_T1 = 't1fmZBMvi4RrmrsFVr3cHvUjRWb3B74uYgQ';
  const OTHER_UA = fixture('derived account 1 all');

  const entry = (
    pool: 'transparent' | 4 | 2,
    address: string,
    side: 'from' | 'to',
    isChange = false,
  ): IOnChainHistoryTxTransfer => ({
    token: '',
    key: '',
    amount: '1',
    label: '',
    type:
      pool === 'transparent'
        ? EOnChainHistoryTransferType.Transfer
        : EOnChainHistoryTransferType.Shielded,
    ...(pool === 'transparent' ? {} : { poolId: pool }),
    address,
    from: side === 'from' ? address : '',
    to: side === 'to' ? address : '',
    isOwn: true,
    isChange,
  });

  async function gatedDetail(
    detail: Partial<IOnChainHistoryTx>,
    displayed = { publicAddress: RECEIVE_T1, privateAddress: RECEIVE_UA },
  ) {
    const { vault, getLocalWalletAccountAddresses } = createVault();
    getLocalWalletAccountAddresses.mockResolvedValue(displayed);
    jest.mocked(zcashHistory.fetchAccountHistoryDetail).mockResolvedValue({
      data: {
        data: {
          data: { tx: 'a', ...detail } as IOnChainHistoryTx,
          tokens: {},
          nfts: {},
        },
      },
    });
    const response = await vault.fetchAccountHistoryDetail({
      ...params,
      txid: 'a',
    });
    return response.data.data.data;
  }

  it('shows a private note as the private address and a public one as the t-address', async () => {
    const detail = await gatedDetail({
      sends: [
        entry('transparent', TABLE_UA, 'from'),
        entry(4, TABLE_UA, 'from'),
        entry(4, '', 'from'),
      ],
      receives: [
        entry(4, TABLE_UA, 'to'),
        entry('transparent', RECEIVE_T1, 'to'),
      ],
    });
    expect(detail.sends.map((item) => item.address)).toEqual([
      RECEIVE_T1,
      RECEIVE_UA,
      '',
    ]);
    expect(detail.receives.map((item) => item.address)).toEqual([
      RECEIVE_UA,
      RECEIVE_T1,
    ]);
  });

  // The UA holds our t-address too, but the money went to its Orchard receiver.
  it('never shows a private note as the t-address', async () => {
    const detail = await gatedDetail(
      { receives: [entry(4, TABLE_UA, 'to')] },
      {
        publicAddress: RECEIVE_T1,
        privateAddress: fixture('derived account 1 orchard'),
      },
    );
    expect(detail.receives[0]).toMatchObject({ address: '', to: '' });
  });

  it.each([
    ['another account', 4, OTHER_UA],
    ['a Sapling note', 2, TABLE_UA],
  ] as const)('names %s by pool', async (_, pool, address) => {
    const detail = await gatedDetail({
      receives: [entry(pool, address, 'to')],
    });
    expect(detail.receives[0]).toMatchObject({ address: '', to: '' });
  });
});
