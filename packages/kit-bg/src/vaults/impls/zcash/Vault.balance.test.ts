import BigNumber from 'bignumber.js';

import type { IZcashBalance } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { SimpleDbEntityPrivacyChainCache } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import VaultBtc from '../btc/Vault';

import Vault from './Vault';
import { zcashReadTransparentForDisplay } from './vaultBalance';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const pool = (amount: string) => ({
  spendable: amount,
  total: amount,
  pendingChange: '0',
  pendingSpendable: '0',
  locked: '0',
});
// Shielded only: the scanner snapshot no longer carries a public half.
// Transparent figures in these cases come from the indexer mocks below.
const balance: IZcashBalance = {
  isComplete: true,
  shielded: '100',
  spendable: '100',
  shieldedSpendable: '100',
  orchardBalance: '100',
  ironwoodBalance: '0',
  pendingChange: '0',
  pendingSpendable: '0',
  poolsDetail: {
    orchard: pool('100'),
    ironwood: pool('0'),
  },
};

function memoryCache() {
  let saved: unknown = null;
  const entity = new SimpleDbEntityPrivacyChainCache();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  return entity;
}

describe('Zcash independent transparent balance availability', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    { utxoFails: true, totalFails: false, spendable: undefined, total: '80' },
    { utxoFails: false, totalFails: true, spendable: '50', total: undefined },
    {
      utxoFails: true,
      totalFails: true,
      spendable: undefined,
      total: undefined,
    },
    { utxoFails: false, totalFails: false, spendable: '50', total: '80' },
  ])(
    'preserves independent known values: %j',
    async ({ utxoFails, totalFails, spendable, total }) => {
      const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
        accountId: 'account',
        networkId: 'zec--0',
        backgroundApi: {
          simpleDb: {
            privacyChain: {},
            zcash: {
              getPrivacyModeState: jest
                .fn()
                .mockResolvedValue({ intent: 'on' }),
            },
          },
          serviceAccount: {
            getDBAccount: jest.fn().mockResolvedValue({ id: 'account' }),
          },
        },
      });
      jest.spyOn(vault, 'getLocalWalletBalance').mockResolvedValue(balance);
      const fresh = jest.fn();
      if (utxoFails)
        fresh.mockRejectedValue(new OneKeyLocalError('UTXO request failed'));
      else fresh.mockResolvedValue({ utxos: [{ valueZat: '50' }] });
      Object.assign(vault, { zcashFetchFreshTransparentUtxos: fresh });
      const backend = jest.spyOn(VaultBtc.prototype, 'fetchTokenDetails');
      if (totalFails)
        backend.mockRejectedValue(new OneKeyLocalError('Total request failed'));
      else
        backend.mockResolvedValue({
          data: { data: [{ info: { isNative: true }, balance: '80' }] },
        } as Awaited<ReturnType<VaultBtc['fetchTokenDetails']>>);

      const sendPools = await vault.listLocalWalletSendPools({
        accountId: 'account',
      });
      const transparent = sendPools?.find((item) => item.key === 'transparent');
      expect(transparent?.spendable).toBe(spendable);
      expect(transparent?.total).toBe(total);
      const accountBalance = await vault.getLocalWalletAccountBalance({
        accountId: 'account',
      });
      expect(
        accountBalance?.pools.find((item) => item.key === 'transparent'),
      ).toMatchObject({ spendable, total });
      expect(accountBalance?.spendable).toBe(
        spendable === undefined ? undefined : '150',
      );
      expect(accountBalance?.total).toBe(
        total === undefined ? undefined : '180',
      );
    },
  );

  it.each([null, { ...balance, isComplete: false }])(
    'preserves the transparent pool when the private scan is incomplete: %j',
    async (privateBalance) => {
      const vault = Object.create(Vault.prototype) as Vault;
      Object.assign(vault, {
        // Privacy Mode is ON here; what is incomplete is the scan, not the
        // account's opt-in. The gate must not confuse the two.
        accountId: 'account',
        networkId: 'zec--0',
        backgroundApi: {
          simpleDb: {
            privacyChain: {},
            privacyChainCache: memoryCache(),
            zcash: {
              getPrivacyModeState: jest
                .fn()
                .mockResolvedValue({ intent: 'on' }),
            },
          },
          serviceAccount: {
            getDBAccount: jest.fn().mockResolvedValue({ id: 'account' }),
          },
        },
        getLocalWalletBalance: jest.fn().mockResolvedValue(privateBalance),
        getAccount: jest.fn().mockResolvedValue({ id: 'account' }),
        zcashGetBalanceSafe: jest.fn().mockResolvedValue(privateBalance),
        zcashGetIndexerTransparentBalance: jest.fn().mockResolvedValue({
          total: new BigNumber(80),
          spendable: new BigNumber(50),
        }),
      });
      const result = await vault.getLocalWalletAccountBalance({
        accountId: 'account',
      });
      expect(result).toMatchObject({
        total: undefined,
        balanceStatus: 'partial',
      });
      expect(result?.pools[0]).toMatchObject({ total: '80', spendable: '50' });
      expect(result?.pools[1].balanceStatus).toBe(
        privateBalance ? 'partial' : 'unavailable',
      );
      // Mid-backfill the home total is what was found so far plus the public
      // side, marked partial; with no private figure, the public side alone.
      expect(await vault.zcashGetComposedBalanceSafe('80')).toMatchObject({
        total: privateBalance ? '180' : '80',
        balanceStatus: 'partial',
      });
    },
  );

  it('retains a known zero instead of marking it unavailable', async () => {
    const vault = Object.create(Vault.prototype) as Vault;
    Object.assign(vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChain: {},
          zcash: {
            getPrivacyModeState: jest.fn().mockResolvedValue({ intent: 'off' }),
          },
        },
        serviceAccount: {
          getDBAccount: jest.fn().mockResolvedValue({ id: 'account' }),
        },
      },
      zcashFetchFreshTransparentUtxos: jest
        .fn()
        .mockResolvedValue({ utxos: [] }),
    });
    jest.spyOn(VaultBtc.prototype, 'fetchTokenDetails').mockResolvedValue({
      data: { data: [{ info: { isNative: true }, balance: '0' }] },
    } as Awaited<ReturnType<VaultBtc['fetchTokenDetails']>>);
    expect(
      await vault.listLocalWalletSendPools({ accountId: 'account' }),
    ).toEqual([
      expect.objectContaining({
        key: 'transparent',
        spendable: '0',
        spendableParsed: '0',
        total: '0',
      }),
    ]);
  });

  it('includes usable transparent funds in account availability without changing private pool spendability', async () => {
    const fresh = jest.fn().mockResolvedValue({ utxos: [{ valueZat: '50' }] });
    const vault = Object.create(Vault.prototype) as Vault;
    Object.assign(vault, {
      accountId: 'account',
      networkId: 'zec--0',
      backgroundApi: { simpleDb: { privacyChainCache: memoryCache() } },
      getAccount: jest.fn().mockResolvedValue({ id: 'account' }),
      zcashGetBalanceSafe: jest.fn().mockResolvedValue(balance),
      zcashFetchFreshTransparentUtxos: fresh,
    });
    expect(await vault.zcashGetComposedBalanceSafe('80')).toMatchObject({
      total: '180',
      spendable: '150',
      frozen: '30',
    });
    expect(balance.poolsDetail.orchard.spendable).toBe('100');
    expect(await vault.zcashGetComposedBalanceSafe('20')).toMatchObject({
      total: '150',
      spendable: '150',
      frozen: '0',
    });
    fresh.mockRejectedValue(new OneKeyLocalError('UTXO request failed'));
    await expect(
      vault.zcashGetComposedBalanceSafe('80'),
    ).resolves.toMatchObject({
      total: '180',
      spendable: '',
      frozen: '',
      balanceStatus: 'complete',
    });
  });
});

// The transparent half's backend requests (UTXOs, then each previous
// transaction, retried) used to hold the private half back with them.
describe('Zcash transparent balance on display', () => {
  afterEach(() => jest.restoreAllMocks());

  function createVault(read: jest.Mock) {
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      zcashGetIndexerTransparentBalance: read,
    });
  }
  const account = { id: 'slow-account' } as Parameters<
    typeof zcashReadTransparentForDisplay
  >[1]['account'];

  it('asks for one retry, not the spend default', async () => {
    const read = jest.fn().mockResolvedValue({ total: new BigNumber(1) });
    await zcashReadTransparentForDisplay(createVault(read), { account });
    expect(read).toHaveBeenCalledWith({ account, rawTxRetries: 1 });
  });

  // The composed balance has the backend total already.
  it('asks only for spendable UTXOs when the total is not needed', async () => {
    const indexer = jest.fn();
    const fresh = jest
      .fn()
      .mockResolvedValue({ utxos: [{ valueZat: '30' }, { valueZat: '20' }] });
    const vault = Object.assign(createVault(indexer), {
      zcashFetchFreshTransparentUtxos: fresh,
    });
    await expect(
      zcashReadTransparentForDisplay(vault, { account, spendableOnly: true }),
    ).resolves.toEqual({ spendable: new BigNumber(50) });
    expect(fresh).toHaveBeenCalledWith({ account, rawTxRetries: 1 });
    expect(indexer).not.toHaveBeenCalled();
  });

  it('answers unknown past the wait, then hands the late result over once', async () => {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const emit = jest.spyOn(appEventBus, 'emit');
    let finish: (value: { total: BigNumber }) => void = () => {};
    const slow = new Promise<{ total: BigNumber }>((resolve) => {
      finish = resolve;
    });
    const read = jest.fn().mockReturnValueOnce(slow);
    const vault = createVault(read);

    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({});

    finish({ total: new BigNumber(80) });
    await slow;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.RefreshTokenList,
      undefined,
    );
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({ total: new BigNumber(80) });
    expect(read).toHaveBeenCalledTimes(1);

    // Handed over once: the next read asks the backend again.
    read.mockResolvedValueOnce({ total: new BigNumber(90) });
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({ total: new BigNumber(90) });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
