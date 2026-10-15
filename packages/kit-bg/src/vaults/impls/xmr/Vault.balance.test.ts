/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import Vault from './Vault';

import type { ILocalWalletAccountBalance } from '../../localWallet/types';

function createVault({
  enabled,
  paused = false,
  backfillComplete = true,
  balance,
}: {
  enabled: boolean;
  paused?: boolean;
  backfillComplete?: boolean;
  balance: () => Promise<ILocalWalletAccountBalance | null>;
}) {
  const vault: Vault = Object.assign(Object.create(Vault.prototype), {
    accountId: 'hd-1--x',
    networkId: 'xmr--0',
    getLocalWalletCapability: () => ({
      getAccountState: async () => ({ enabled, paused }),
      getAccountBalance: balance,
      getSyncProgress: async () => ({ isBackfillComplete: backfillComplete }),
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

// '' is "unknown" to the token list; '0' is a confirmed zero. A scanned
// account that cannot answer right now is the former, never the latter.
describe('xmr balance for display', () => {
  // Never scanned is not a known zero, and must not pull totals down to "--".
  it('reports a never-scanned account as not enabled, not as zero', async () => {
    const vault = createVault({ enabled: false, balance: async () => null });
    await expect(readBalance(vault)).resolves.toMatchObject({
      data: { data: { balance: '' } },
    });
    await expect(readTokenFiat(vault)).resolves.toMatchObject({
      balance: '',
      balanceStatus: 'notEnabled',
    });
  });

  it('marks a balance still backfilling as partial', async () => {
    const vault = createVault({
      enabled: true,
      backfillComplete: false,
      balance: async () => ({
        total: '1000000000000',
        totalParsed: '1',
        pools: [],
      }),
    });
    await expect(readTokenFiat(vault)).resolves.toMatchObject({
      balance: '1000000000000',
      balanceStatus: 'partial',
    });
  });

  it('reports unknown when a scanned account has no figure yet', async () => {
    const vault = createVault({ enabled: true, balance: async () => null });
    await expect(readBalance(vault)).resolves.toMatchObject({
      data: { data: { balance: '' } },
    });
  });

  it('reports unknown when the runtime cannot be reached', async () => {
    const vault = createVault({
      enabled: true,
      balance: () => Promise.reject(new Error('runtime down')),
    });
    await expect(readBalance(vault)).resolves.toMatchObject({
      data: { data: { balance: '' } },
    });
  });

  it('hides a paused account balance, as it hides every private surface', async () => {
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
      data: { data: { balance: '', totalBalance: '' } },
    });
    await expect(readTokenFiat(vault)).resolves.toMatchObject({
      balanceStatus: 'notEnabled',
    });
  });

  // The balance-details dialog labels `balance` as spendable.
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

// The send page spends `balance`: unlocked only, as wallet2's unlocked
// balance. The total (with locked change of a pending send) rides alongside.
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
