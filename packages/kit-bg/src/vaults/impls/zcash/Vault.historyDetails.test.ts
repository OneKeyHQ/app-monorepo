/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { EOnChainHistoryTransferType } from '@onekeyhq/shared/types/history';

import Vault from './Vault';

it.each([false, true])(
  'keeps known output facts without inventing an unknown recipient, withUTXOs=%s',
  async (withUTXOs) => {
    const memoBinary = { hex: 'ff'.repeat(512), hash: '11'.repeat(32) };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'synthetic-account',
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: { getPrivacyModeState: async () => ({ intent: 'on' }) },
        },
      },
      zcashGetWalletAccount: async () => ({}),
      zcashGetApi: async () => ({
        getHistory: async () => [
          {
            txid: 'synthetic-tx',
            minedHeight: 100,
            timestamp: 1,
            fee: '10000',
            pending: false,
            poolIds: [4],
          },
        ],
        getSyncProgress: async () => ({ chainTip: 110 }),
        getTxDetails: async () => ({
          spent: [{ pool: 'ironwood', value: '222345', address: null }],
          received: [
            {
              pool: 'ironwood',
              value: '200000',
              address: null,
              internal: true,
              memo: 'change memo',
            },
          ],
          external: [
            {
              pool: 'ironwood',
              value: '12345',
              address: null,
              memo: 'payment memo',
              memoBinary,
            },
          ],
        }),
      }),
    });
    const response = await vault.fetchAccountHistoryDetail({
      accountId: 'synthetic-account',
      networkId: 'zec--0',
      txid: 'synthetic-tx',
      privacyChainPoolId: 4,
      withUTXOs,
    });
    const detail = response.data.data.data;
    expect(detail.receives?.[0]).toMatchObject({
      type: EOnChainHistoryTransferType.Shielded,
      amount: '0.00012345',
      address: '',
      to: '',
      label: 'Ironwood pool',
      isOwn: false,
    });
    expect(detail.receives).toHaveLength(withUTXOs ? 2 : 1);
    if (withUTXOs)
      expect(detail.receives?.[1]).toMatchObject({
        amount: '0.002',
        isChange: true,
        isOwn: true,
      });
    expect(detail.memo).toBe('payment memo');
    expect(detail.binaryMemos).toEqual([memoBinary]);
    expect(detail.gasFee).toBe('0.0001');
    expect(detail.confirmations).toBe(11);
  },
);
