/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./runtime', () => ({
  getXmrIdentityId: async () => '7',
  getXmrLocalRuntime: (vault: { getXmrRuntimeApi: () => Promise<unknown> }) =>
    vault.getXmrRuntimeApi(),
  readXmrStaleFirst: <T>(p: { read: () => Promise<T> }) => p.read(),
}));

import Vault from './Vault';

// The cached list is replaced by what the runtime returns; stopping at one
// page would delete every older row from it.
describe('xmr history paging', () => {
  it('reads every page', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ txid: `t${i}` }));
    const history = jest.fn(
      async (_id: string, limit: number, offset: number) =>
        JSON.stringify({
          items: rows.slice(offset, offset + limit),
          total: rows.length,
        }),
    );
    const vault: Vault = Object.assign(Object.create(Vault.prototype), {
      getXmrRuntimeApi: async () => ({ history }),
      backgroundApi: {
        simpleDb: { privacyChainState: { getAccountEpoch: async () => 'e1' } },
      },
    });

    const items = await (
      vault as unknown as {
        xmrListHistoryItems: (p: {
          accountId: string;
        }) => Promise<{ txid: string }[] | undefined>;
      }
    ).xmrListHistoryItems({ accountId: 'hd-1--x' });

    expect(items).toHaveLength(1200);
    expect(history).toHaveBeenCalledTimes(3);
  });
});
