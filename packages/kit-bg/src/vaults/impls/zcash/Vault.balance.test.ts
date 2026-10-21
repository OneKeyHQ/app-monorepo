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
// Shielded only; transparent figures come from the indexer mocks below.
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
            privacyChainState: {
              getZcashPrivacyModeState: jest
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
            privacyChainCache: memoryCache(),
            privacyChainState: {
              getZcashPrivacyModeState: jest
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
          privacyChainState: {
            getZcashPrivacyModeState: jest
              .fn()
              .mockResolvedValue({ intent: 'off' }),
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
// transaction, retried) must not hold the private half back.
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

  it('answers unknown past the wait, then hands the late result over for a short window', async () => {
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
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({ total: new BigNumber(80) });
    expect(read).toHaveBeenCalledTimes(1);

    // Past the window the next read asks the backend again.
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    read.mockResolvedValueOnce({ total: new BigNumber(90) });
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({ total: new BigNumber(90) });
    expect(read).toHaveBeenCalledTimes(2);
  });
});

// A restart has no in-memory UTXOs; the Transparent tab shows the last pair
// instead of waiting on the backend.
describe('Zcash transparent balance saved for the next open', () => {
  afterEach(() => jest.restoreAllMocks());

  const saved = { total: '80', spendable: '50' };

  async function createVault(
    accountId: string,
    read: jest.Mock,
    seed?: typeof saved,
  ) {
    const privacyChainCache = memoryCache();
    if (seed) {
      await privacyChainCache.setLastPublicBalance({
        accountId,
        record: { networkId: 'zec--0', ...seed, savedAt: 1 },
      });
    }
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainCache,
          privacyChainState: {
            getZcashPrivacyModeState: jest
              .fn()
              .mockResolvedValue({ intent: 'on' }),
          },
        },
        serviceAccount: {
          getDBAccount: jest.fn().mockResolvedValue({ id: accountId }),
        },
      },
      zcashGetIndexerTransparentBalance: read,
    });
    const account = { id: accountId } as Parameters<
      typeof zcashReadTransparentForDisplay
    >[1]['account'];
    return { vault, account, privacyChainCache };
  }

  function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }

  const flush = () => new Promise((done) => setTimeout(done, 0));

  it('shows the saved pair while the backend is slow, then hands the fresh one over', async () => {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const emit = jest.spyOn(appEventBus, 'emit');
    const slow = deferred<{ total: BigNumber; spendable: BigNumber }>();
    const read = jest.fn().mockReturnValueOnce(slow.promise);
    const { vault, account, privacyChainCache } = await createVault(
      'cached-slow',
      read,
      saved,
    );

    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({
      total: new BigNumber(80),
      spendable: new BigNumber(50),
      stale: true,
    });

    slow.resolve({ total: new BigNumber(90), spendable: new BigNumber(60) });
    await flush();
    await expect(
      privacyChainCache.getLastPublicBalance({ accountId: 'cached-slow' }),
    ).resolves.toMatchObject({ total: '90', spendable: '60' });
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.LocalWalletBalanceLanded,
      { networkId: 'zec--0', accountId: 'cached-slow' },
    );
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({
      total: new BigNumber(90),
      spendable: new BigNumber(60),
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('marks a late value that matches the saved pair as current without refreshing lists', async () => {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const emit = jest.spyOn(appEventBus, 'emit');
    const slow = deferred<{ total: BigNumber; spendable: BigNumber }>();
    const read = jest.fn().mockReturnValueOnce(slow.promise);
    const { vault, account } = await createVault('cached-same', read, saved);
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toMatchObject({ stale: true });
    slow.resolve({ total: new BigNumber(80), spendable: new BigNumber(50) });
    await flush();
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.LocalWalletBalanceLanded,
      { networkId: 'zec--0', accountId: 'cached-same' },
    );
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({
      total: new BigNumber(80),
      spendable: new BigNumber(50),
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  // The password alert and the pool both read on the landed event; whichever
  // goes first must not leave the other with the saved pair again.
  it('hands a landed value to every reader in the window', async () => {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const slow = deferred<{ total: BigNumber; spendable: BigNumber }>();
    const read = jest.fn().mockReturnValueOnce(slow.promise);
    const { vault, account } = await createVault('cached-shared', read, saved);
    await zcashReadTransparentForDisplay(vault, { account });
    slow.resolve({ total: new BigNumber(90), spendable: new BigNumber(60) });
    await flush();
    const fresh = { total: new BigNumber(90), spendable: new BigNumber(60) };
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual(fresh);
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual(fresh);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps the last fresh pair current while the next read is slow', async () => {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const emit = jest.spyOn(appEventBus, 'emit');
    const next = deferred<{ total: BigNumber; spendable: BigNumber }>();
    const read = jest
      .fn()
      .mockResolvedValueOnce({
        total: new BigNumber(90),
        spendable: new BigNumber(60),
      })
      .mockReturnValueOnce(next.promise);
    const { vault, account } = await createVault('cached-poll', read, saved);
    await zcashReadTransparentForDisplay(vault, { account });
    await flush();
    const fresh = { total: new BigNumber(90), spendable: new BigNumber(60) };
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual(fresh);

    // The poll after it: a new value still replaces the old one.
    next.resolve({ total: new BigNumber(95), spendable: new BigNumber(65) });
    await flush();
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.RefreshTokenList,
      undefined,
    );
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({
      total: new BigNumber(95),
      spendable: new BigNumber(65),
    });
  });

  it('keeps the saved pair over a late read that lost one half', async () => {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const emit = jest.spyOn(appEventBus, 'emit');
    const slow = deferred<{ total?: BigNumber; spendable?: BigNumber }>();
    const { vault, account, privacyChainCache } = await createVault(
      'cached-partial',
      jest.fn().mockReturnValueOnce(slow.promise),
      saved,
    );
    await zcashReadTransparentForDisplay(vault, { account });
    slow.resolve({ total: new BigNumber(90) });
    await flush();
    expect(emit).not.toHaveBeenCalled();
    await expect(
      privacyChainCache.getLastPublicBalance({ accountId: 'cached-partial' }),
    ).resolves.toMatchObject(saved);
  });

  it('saves a fresh pair that answers in time', async () => {
    const read = jest.fn().mockResolvedValue({
      total: new BigNumber(70),
      spendable: new BigNumber(40),
    });
    const { vault, account, privacyChainCache } = await createVault(
      'fresh-in-time',
      read,
    );
    await expect(
      zcashReadTransparentForDisplay(vault, { account }),
    ).resolves.toEqual({
      total: new BigNumber(70),
      spendable: new BigNumber(40),
    });
    await flush();
    await expect(
      privacyChainCache.getLastPublicBalance({ accountId: 'fresh-in-time' }),
    ).resolves.toMatchObject({ total: '70', spendable: '40' });
  });

  it('marks the transparent pool as not current while it shows the saved pair', async () => {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const { vault } = await createVault(
      'cached-pool',
      jest.fn().mockReturnValueOnce(new Promise(() => {})),
      saved,
    );
    jest.spyOn(vault, 'getLocalWalletBalance').mockResolvedValue(balance);
    const result = await vault.getLocalWalletAccountBalance({
      accountId: 'cached-pool',
    });
    expect(result?.pools[0]).toMatchObject({
      key: 'transparent',
      balanceStatus: 'partial',
      total: '80',
      spendable: '50',
    });
    expect(result?.balanceStatus).toBe('partial');
  });

  // Shield sweeps the UTXOs it fetches itself, but it is only offered on a
  // figure that is current.
  it('offers shield only once the transparent figure is current', async () => {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const large = { total: '90000', spendable: '90000' };
    const slow = deferred<{ total: BigNumber; spendable: BigNumber }>();
    const { vault } = await createVault(
      'cached-shield',
      jest.fn().mockReturnValueOnce(slow.promise),
      large,
    );
    jest.spyOn(vault, 'getLocalWalletBalance').mockResolvedValue(balance);
    const before = await vault.getLocalWalletAccountBalance({
      accountId: 'cached-shield',
    });
    expect(before?.pools[0].move).toMatchObject({
      type: 'shield',
      enabled: false,
    });

    slow.resolve({
      total: new BigNumber(90_000),
      spendable: new BigNumber(90_000),
    });
    await flush();
    const after = await vault.getLocalWalletAccountBalance({
      accountId: 'cached-shield',
    });
    expect(after?.pools[0]).toMatchObject({ balanceStatus: 'complete' });
    expect(after?.pools[0].move).toMatchObject({
      type: 'shield',
      enabled: true,
    });
  });
});

// The amount page's available figure, Max and the insufficient-funds check
// come from the send pools; a saved private balance must never stand in.
describe('Zcash send pools read the private balance fresh', () => {
  afterEach(() => jest.restoreAllMocks());

  async function createVault(accountId: string, scannerFails: boolean) {
    const privacyChainCache = memoryCache();
    await privacyChainCache.setLastBalance({
      accountId,
      record: {
        networkId: 'zec--0',
        value: JSON.stringify(balance),
        savedAt: 1,
      },
    });
    const getBalance = scannerFails
      ? jest.fn().mockRejectedValue(new OneKeyLocalError('scanner busy'))
      : jest.fn().mockResolvedValue({
          ...balance,
          poolsDetail: { ...balance.poolsDetail, orchard: pool('70') },
        });
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainCache,
          privacyChainState: {
            getZcashPrivacyModeState: jest
              .fn()
              .mockResolvedValue({ intent: 'on' }),
          },
        },
        serviceAccount: {
          getDBAccount: jest.fn().mockResolvedValue({ id: accountId }),
        },
      },
      zcashGetWalletAccount: jest.fn().mockResolvedValue({}),
      zcashGetApi: jest.fn().mockResolvedValue({ getBalance }),
      zcashGetIndexerTransparentBalance: jest.fn().mockResolvedValue({
        total: new BigNumber(80),
        spendable: new BigNumber(50),
      }),
    });
  }

  it('leaves the private pools without a figure when the scanner fails', async () => {
    const vault = await createVault('send-fails', true);
    const pools = await vault.listLocalWalletSendPools({
      accountId: 'send-fails',
    });
    expect(pools?.find((item) => item.key === 'orchard')?.spendable).toBe(
      undefined,
    );
    // Display reads still fall back to the saved balance.
    await expect(
      vault.getLocalWalletBalance({ accountId: 'send-fails' }),
    ).resolves.toMatchObject({ isComplete: false, shielded: '100' });
  });

  it('uses the scanner answer, not the saved balance', async () => {
    const vault = await createVault('send-live', false);
    const pools = await vault.listLocalWalletSendPools({
      accountId: 'send-live',
    });
    expect(pools?.find((item) => item.key === 'orchard')?.spendable).toBe('70');
    expect(pools?.find((item) => item.key === 'transparent')?.spendable).toBe(
      '50',
    );
  });
});
