/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

const mockQuoteTokenDetails = jest.fn();
jest.mock('../../factory', () => ({
  vaultFactory: {
    getChainOnlyVault: async () => ({
      fetchTokenDetailsByApi: mockQuoteTokenDetails,
    }),
  },
}));

import Vault from './Vault';

import type { ILocalWalletAccountBalance } from '../../localWallet/types';

function createVault({
  enabled,
  paused = false,
  pendingOperation,
  balance,
}: {
  enabled: boolean;
  paused?: boolean;
  pendingOperation?: 'enable' | 'disable';
  balance: () => Promise<ILocalWalletAccountBalance | null>;
}) {
  const vault: Vault = Object.assign(Object.create(Vault.prototype), {
    accountId: 'hd-1--x',
    networkId: 'xmr--0',
    getLocalWalletCapability: () => ({
      getAccountState: async () => ({ enabled, paused, pendingOperation }),
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

describe('xmr balance for display', () => {
  it('shows zero while scanning is not enabled, without asking the scanner', async () => {
    const balance = jest.fn(async () => null);
    const vault = createVault({ enabled: false, balance });
    await expect(readBalance(vault)).resolves.toMatchObject({
      data: { data: { balance: '0' } },
    });
    await expect(readTokenFiat(vault)).resolves.toMatchObject({
      balance: '0',
      fiatValue: '0',
    });
    expect(balance).not.toHaveBeenCalled();
  });

  // Fails as a backend read does on other chains, so pages keep what they show.
  it.each([
    ['without a figure yet', { enabled: true, balance: async () => null }],
    [
      'with the runtime unreachable',
      {
        enabled: true,
        balance: () => Promise.reject(new Error('runtime down')),
      },
    ],
    [
      'while scanning is being turned on',
      { enabled: false, pendingOperation: 'enable', balance: async () => null },
    ],
    [
      'while a paused account is busy',
      { enabled: false, paused: true, balance: async () => null },
    ],
  ] as [string, Parameters<typeof createVault>[0]][])(
    'fails the read %s instead of showing zero',
    async (_label, options) => {
      const vault = createVault(options);
      const unavailable = { message: 'xmr: balance unavailable' };
      await expect(readBalance(vault)).rejects.toMatchObject(unavailable);
      await expect(readTokenFiat(vault)).rejects.toMatchObject(unavailable);
      await expect(vault.fetchTokenDetails({} as never)).rejects.toMatchObject({
        ...unavailable,
        autoToast: false,
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

// Priced like other chains, from a quote that names only the network.
describe('xmr fiat value', () => {
  const ownAddress =
    '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A';

  function createPricedVault(quote: () => Promise<string>) {
    mockQuoteTokenDetails.mockReset();
    mockQuoteTokenDetails.mockImplementation(async () => ({
      data: { data: [{ info: { address: '' }, price: await quote() }] },
    }));
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
          serviceToken: { getNativeTokenAddress: async () => '' },
        },
      },
    );
    return { vault };
  }

  it('values the home row and the token details at the market price', async () => {
    const { vault } = createPricedVault(async () => '150');
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
    const quoteRequest = {
      networkId: 'xmr--0',
      contractList: [''],
      requestCurrency: 'usd',
    };
    expect(mockQuoteTokenDetails.mock.calls).toEqual([
      [quoteRequest],
      [quoteRequest],
    ]);
    expect(JSON.stringify(mockQuoteTokenDetails.mock.calls)).not.toContain(
      ownAddress,
    );
  });

  it('leaves fiat unknown while the quote is unavailable', async () => {
    const { vault } = createPricedVault(() =>
      Promise.reject(new Error('40056')),
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
