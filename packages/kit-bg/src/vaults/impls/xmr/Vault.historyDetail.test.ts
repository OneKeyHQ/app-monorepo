/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import Vault from './Vault';

import type { IXmrHistoryItem } from './types';

const ACCOUNT_ID = "hd-1--m/44'/128'/0'";
const TXID = 'aa'.repeat(32);

function item(patch: Partial<IXmrHistoryItem>): IXmrHistoryItem {
  return {
    txid: TXID,
    height: null,
    direction: 'out',
    receivedAtomic: '0',
    spentAtomic: '1000',
    timestamp: null,
    ...patch,
  };
}

// The detail page polls this while a row is pending; Monero answers from the
// scanned rows, never the backend, since the address must not leave the device.
describe('xmr history detail', () => {
  function createVault({
    rows,
    state = { intent: 'on' },
    chainTip = 3_100_009,
  }: {
    rows: IXmrHistoryItem[] | undefined;
    state?: Record<string, unknown>;
    chainTip?: number | null;
  }) {
    const xmrListHistoryItems = jest.fn(async () => rows);
    const getClient = jest.fn(() => {
      throw new OneKeyLocalError('backend must not be called');
    });
    const vault: Vault = Object.assign(Object.create(Vault.prototype), {
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      xmrListHistoryItems,
      backgroundApi: {
        simpleDb: { xmr: { getAccountState: async () => state } },
        servicePrivacyChain: {
          getLocalWalletSyncProgress: async () => ({ chainTip }),
        },
        serviceGas: { getClient },
      },
    });
    const fetchDetail = () =>
      vault.fetchAccountHistoryDetail({
        accountId: ACCOUNT_ID,
        networkId: 'xmr--0',
        txid: TXID,
      });
    return { fetchDetail, xmrListHistoryItems, getClient };
  }

  it('reports a pending row as pending, without I/O', async () => {
    const { fetchDetail, getClient } = createVault({ rows: [item({})] });
    const detail = (await fetchDetail()).data.data;
    expect(detail.data).toMatchObject({
      tx: TXID,
      status: EOnChainHistoryTxStatus.Pending,
    });
    expect(detail.data.block).toBeUndefined();
    expect(detail.data.confirmations).toBeUndefined();
    expect(detail.data.sends).toBeUndefined();
    expect(detail.data.receives).toBeUndefined();
    expect(detail.data.gasFee).toBeUndefined();
    expect(getClient).not.toHaveBeenCalled();
  });

  it('reports a mined row with its block and confirmations', async () => {
    const { fetchDetail } = createVault({
      rows: [
        item({ txid: 'bb'.repeat(32), height: 1 }),
        item({ height: 3_100_000, timestamp: 1_760_000_000 }),
      ],
    });
    await expect(fetchDetail()).resolves.toMatchObject({
      data: {
        data: {
          data: {
            tx: TXID,
            status: EOnChainHistoryTxStatus.Success,
            block: 3_100_000,
            confirmations: 10,
            timestamp: 1_760_000_000,
          },
        },
      },
    });
  });

  it('reports a send the node never accepted as failed', async () => {
    const { fetchDetail } = createVault({
      rows: [item({ failed: true })],
      chainTip: null,
    });
    await expect(fetchDetail()).resolves.toMatchObject({
      data: { data: { data: { status: EOnChainHistoryTxStatus.Failed } } },
    });
  });

  it.each([
    ['unknown txid', [item({ txid: 'cc'.repeat(32) })]],
    ['runtime cannot answer', undefined],
  ])('throws when the row is missing: %s', async (_label, rows) => {
    const { fetchDetail, getClient } = createVault({ rows });
    await expect(fetchDetail()).rejects.toThrow('not found locally');
    expect(getClient).not.toHaveBeenCalled();
  });

  it('does not read the runtime for an account that never enabled scanning', async () => {
    const { fetchDetail, xmrListHistoryItems } = createVault({
      rows: [item({})],
      state: { intent: 'off' },
    });
    await expect(fetchDetail()).rejects.toThrow('not found locally');
    expect(xmrListHistoryItems).not.toHaveBeenCalled();
  });
});
