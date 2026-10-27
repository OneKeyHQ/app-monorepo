/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { EOnChainHistoryTransferType } from '@onekeyhq/shared/types/history';

import Vault from './Vault';

it.each(
  (
    [
      [false, false, 1],
      [true, false, 1],
      [false, true, 1],
      [true, true, 1],
      [false, false, 2],
      [true, false, 2],
      [false, true, 2],
      [true, true, 2],
    ] as const
  ).flatMap((entry) =>
    [false, true].flatMap((pending) =>
      [false, true].map((paused) => [...entry, pending, paused] as const),
    ),
  ),
)(
  'keeps known payment facts, withUTXOs=%s, selfPayment=%s, outputCount=%s, pending=%s, paused=%s',
  async (withUTXOs, selfPayment, outputCount, pending, paused) => {
    const memoBinary = { hex: 'ff'.repeat(512), hash: '11'.repeat(32) };
    const payment = {
      pool: 'ironwood',
      value: '12345',
      address: selfPayment ? 'u1synthetic-recipient' : null,
      internal: false,
      memo: 'payment memo',
      memoBinary,
    };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'synthetic-account',
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            getZcashPrivacyModeState: async () =>
              paused
                ? { intent: 'off', resumeFromHeight: 100 }
                : { intent: 'on' },
          },
        },
        servicePrivacyChain: {
          getLocalWalletAccountAddresses: async () => ({
            privateAddress: 'u1synthetic-recipient',
          }),
        },
      },
      zcashGetWalletAccount: async () => ({}),
      zcashGetApi: async () => ({
        getHistory: async () => [
          {
            txid: 'synthetic-tx',
            minedHeight: pending ? null : 100,
            timestamp: 1,
            fee: '10000',
            pending,
            poolIds: [4],
          },
        ],
        getSyncProgress: async () => ({ chainTip: 110 }),
        getTxDetails: async () => ({
          spent: [
            {
              pool: 'ironwood',
              value: String(210_000 + 12_345 * outputCount),
              address: null,
            },
          ],
          received: [
            ...(selfPayment
              ? Array.from({ length: outputCount }, () => ({
                  ...payment,
                }))
              : []),
            {
              pool: 'ironwood',
              value: '200000',
              address: null,
              internal: true,
              memo: 'change memo',
            },
          ],
          external: selfPayment
            ? []
            : Array.from({ length: outputCount }, () => ({
                ...payment,
              })),
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
      address: selfPayment ? payment.address : '',
      to: selfPayment ? payment.address : '',
      label: '',
      poolId: 4,
      isOwn: selfPayment,
    });
    expect(detail.receives).toHaveLength(outputCount + (withUTXOs ? 1 : 0));
    if (withUTXOs)
      expect(detail.receives?.[outputCount]).toMatchObject({
        type: EOnChainHistoryTransferType.Shielded,
        amount: '0.002',
        address: '',
        poolId: 4,
        isChange: true,
        isOwn: true,
      });
    expect(detail.memo).toBe(
      Array.from({ length: outputCount }, () => 'payment memo').join('\n'),
    );
    expect(detail.binaryMemos).toEqual(
      Array.from({ length: outputCount }, () => memoBinary),
    );
    expect(detail.gasFee).toBe('0.0001');
    expect(detail.confirmations).toBe(pending ? undefined : 11);
  },
);
