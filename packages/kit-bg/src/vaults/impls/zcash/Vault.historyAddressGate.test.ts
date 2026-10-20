/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./vaultHistory', () => ({
  ...jest.requireActual<typeof import('./vaultHistory')>('./vaultHistory'),
  fetchAccountHistoryFromLocal: jest.fn(),
  fetchAccountHistoryDetail: jest.fn(),
}));

import { EOnChainHistoryTransferType } from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
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
  expect(JSON.stringify(rows)).not.toContain(LEGACY_CHANGE);
  expect(
    rows?.[0].decodedTx.actions[0].assetTransfer?.receives[0],
  ).toMatchObject({ to: '', shieldedTo: { poolId: 0, isOwn: true } });
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
