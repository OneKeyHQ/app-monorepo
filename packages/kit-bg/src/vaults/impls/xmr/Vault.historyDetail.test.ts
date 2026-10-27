/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

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

// Answered from scanned rows, never the backend: the address must not leave the device.
describe('xmr history detail', () => {
  function createVault({
    rows,
    state = { intent: 'on' },
    chainTip = 3_100_009,
    sent = {},
  }: {
    rows: IXmrHistoryItem[] | undefined;
    state?: Record<string, unknown>;
    chainTip?: number | null;
    sent?: Record<string, { recipient: string }> | Error;
  }) {
    const xmrListHistoryItems = jest.fn(async () => rows);
    const listXmrSent = jest.fn(async () => {
      if (sent instanceof Error) throw sent;
      return sent;
    });
    const getClient = jest.fn(() => {
      throw new OneKeyLocalError('backend must not be called');
    });
    const vault: Vault = Object.assign(Object.create(Vault.prototype), {
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      xmrListHistoryItems,
      backgroundApi: {
        simpleDb: {
          privacyChainState: { getXmrAccountState: async () => state },
          privacyChainXmrSent: { listXmrSent },
        },
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
    return { fetchDetail, xmrListHistoryItems, getClient, listXmrSent };
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

  describe('payment ID as the memo', () => {
    // monero-address 0.1.0 test vectors: an address and it with payment ID b8963a57855cf73f.
    const STANDARD =
      '4B33mFPMq6mKi7Eiyd5XuyKRVMGVZz1Rqb9ZTyGApXW5d1aT7UBDZ89ewmnWFkzJ5wPd2SFbn313vCT8a4E2Qf4KQH4pNey';
    const INTEGRATED =
      '4Ljin4CrSNHKi7Eiyd5XuyKRVMGVZz1Rqb9ZTyGApXW5d1aT7UBDZ89ewmnWFkzJ5wPd2SFbn313vCT8a4E2Qf4KbaTH6MnpXSn88oBX35';

    const memoOf = async (
      fetchDetail: () => ReturnType<Vault['fetchAccountHistoryDetail']>,
    ) => (await fetchDetail()).data.data.data.memo;

    it("reads a send's payment ID from the integrated address it paid", async () => {
      const { fetchDetail } = createVault({
        rows: [item({})],
        sent: { [TXID]: { recipient: INTEGRATED } },
      });
      await expect(memoOf(fetchDetail)).resolves.toBe('b8963a57855cf73f');
    });

    it.each([
      ['a standard address', { [TXID]: { recipient: STANDARD } }],
      ['no recorded recipient', {}],
      ['an unreadable journal', new Error('unreadable')],
    ])('has no memo for a send to %s', async (_label, sent) => {
      const { fetchDetail } = createVault({ rows: [item({})], sent });
      await expect(memoOf(fetchDetail)).resolves.toBeUndefined();
    });

    it('reports the payment ID the scan decrypted for a receive', async () => {
      const { fetchDetail, listXmrSent } = createVault({
        rows: [item({ direction: 'in', paymentId: '1234567890abcdef' })],
        sent: { [TXID]: { recipient: INTEGRATED } },
      });
      await expect(memoOf(fetchDetail)).resolves.toBe('1234567890abcdef');
      expect(listXmrSent).not.toHaveBeenCalled();
    });

    it.each([
      ['an older runtime', {}],
      ['none on chain', { paymentId: null }],
    ])('has no memo for a receive from %s', async (_label, patch) => {
      const { fetchDetail } = createVault({
        rows: [item({ direction: 'in', ...patch })],
      });
      await expect(memoOf(fetchDetail)).resolves.toBeUndefined();
    });
  });
});
