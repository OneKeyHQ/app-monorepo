/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

import Vault from './Vault';

import type { ILocalWalletAccountBalance } from '../../localWallet/types';

function createVault({
  enabled,
  paused = false,
  balance,
}: {
  enabled: boolean;
  paused?: boolean;
  balance: () => Promise<ILocalWalletAccountBalance | null>;
}) {
  const vault: Vault = Object.assign(Object.create(Vault.prototype), {
    accountId: 'hd-1--x',
    networkId: 'xmr--0',
    getLocalWalletCapability: () => ({
      getAccountState: async () => ({ enabled, paused }),
      getAccountBalance: balance,
    }),
    getNetwork: async () => ({
      decimals: 12,
      name: 'Monero',
      symbol: 'XMR',
      logoURI: '',
    }),
  });
  return vault;
}

function readTokenFiat(vault: Vault) {
  return vault
    .fetchTokenList({
      requestApiParams: { networkId: 'xmr--0', accountAddress: 'a' },
    } as never)
    .then((response) => Object.values(response.data.data.tokens.map)[0]);
}

function readBalance(vault: Vault) {
  return vault.fetchAccountDetails({ accountAddress: 'a' } as never);
}

// Not enabled or unreadable shows zero, as other chains do.
describe('xmr balance for display', () => {
  it.each([
    ['not enabled', { enabled: false, balance: async () => null }],
    ['without a figure yet', { enabled: true, balance: async () => null }],
    [
      'with the runtime unreachable',
      {
        enabled: true,
        balance: () => Promise.reject(new Error('runtime down')),
      },
    ],
  ] as [string, Parameters<typeof createVault>[0]][])(
    'shows zero %s',
    async (_label, options) => {
      const vault = createVault(options);
      await expect(readBalance(vault)).resolves.toMatchObject({
        data: { data: { balance: '0' } },
      });
      await expect(readTokenFiat(vault)).resolves.toMatchObject({
        balance: '0',
        fiatValue: '0',
      });
    },
  );

  it('keeps a paused account balance in the home list and account totals', async () => {
    const vault = createVault({
      enabled: false,
      paused: true,
      balance: async () => ({
        total: '1000000000000',
        totalParsed: '1',
        pools: [],
      }),
    });
    await expect(readBalance(vault)).resolves.toMatchObject({
      data: {
        data: { balance: '1000000000000', totalBalance: '1000000000000' },
      },
    });
    await expect(readTokenFiat(vault)).resolves.toMatchObject({
      balance: '1000000000000',
      balanceParsed: '1',
    });
  });

  it('splits the total into spendable and frozen', async () => {
    const vault = createVault({
      enabled: true,
      balance: async () => ({
        total: '3000000000000',
        totalParsed: '3',
        spendable: '1000000000000',
        pools: [],
      }),
    });
    await expect(readBalance(vault)).resolves.toMatchObject({
      data: {
        data: {
          balance: '1000000000000',
          balanceParsed: '1',
          totalBalanceParsed: '3',
          frozenBalance: '2000000000000',
          frozenBalanceParsed: '2',
        },
      },
    });
  });
});

// The send page spends `balance`: unlocked only, as wallet2 does.
describe('xmr token details for the send page', () => {
  it('offers the unlocked amount and reports the rest as locked', async () => {
    const vault = createVault({
      enabled: true,
      balance: async () => ({
        total: '3000000000000',
        totalParsed: '3',
        spendable: '1000000000000',
        pools: [],
      }),
    });
    const response = await vault.fetchTokenDetails({} as never);
    expect(response.data.data[0]).toMatchObject({
      balance: '1000000000000',
      balanceParsed: '1',
      frozenBalance: '2000000000000',
      totalBalance: '3000000000000',
    });
  });
});

// Priced like other chains, from a quote that names only the asset.
describe('xmr fiat value', () => {
  const ownAddress =
    '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A';

  function createPricedVault(
    quote: () => Promise<{ stats: { currentPrice: string } }>,
  ) {
    const fetchMarketTokenDetail = jest.fn(quote);
    const vault = Object.assign(
      createVault({
        enabled: true,
        balance: async () => ({
          total: '3000000000000',
          totalParsed: '3',
          spendable: '1000000000000',
          pools: [],
        }),
      }),
      {
        backgroundApi: {
          serviceMarket: { fetchMarketTokenDetail },
        },
      },
    );
    return { vault, fetchMarketTokenDetail };
  }

  it('values the home row and the token details at the market price', async () => {
    const { vault, fetchMarketTokenDetail } = createPricedVault(async () => ({
      stats: { currentPrice: '150' },
    }));
    const list = await vault.fetchTokenList({
      requestApiParams: { networkId: 'xmr--0', accountAddress: ownAddress },
      requestCurrency: 'usd',
    } as never);
    expect(Object.values(list.data.data.tokens.map)[0]).toMatchObject({
      price: 150,
      fiatValue: '450',
    });
    const details = await vault.fetchTokenDetails({
      networkId: 'xmr--0',
      accountAddress: ownAddress,
      contractList: [''],
      requestCurrency: 'usd',
    } as never);
    expect(details.data.data[0]).toMatchObject({
      price: 150,
      fiatValue: '150',
      frozenBalanceFiatValue: '300',
      totalBalanceFiatValue: '450',
    });
    expect(fetchMarketTokenDetail.mock.calls).toEqual([
      ['monero', false, 'usd'],
      ['monero', false, 'usd'],
    ]);
    expect(JSON.stringify(fetchMarketTokenDetail.mock.calls)).not.toContain(
      ownAddress,
    );
  });

  it('leaves fiat unknown while the quote is unavailable', async () => {
    const { vault } = createPricedVault(() =>
      Promise.reject(new Error('30011')),
    );
    await expect(readTokenFiat(vault)).resolves.toMatchObject({
      price: 0,
      fiatValue: '',
    });
    const details = await vault.fetchTokenDetails({} as never);
    expect(details.data.data[0]).toMatchObject({
      price: 0,
      fiatValue: '',
      totalBalanceFiatValue: '',
    });
  });
});
