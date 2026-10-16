import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { SimpleDbEntityPrivacyChainCache } from '../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';

import {
  readLastLocalWalletPublicBalance,
  readLocalWalletBalanceStaleFirst,
  removeLastLocalWalletBalances,
  removeNetworkLastLocalWalletBalances,
  saveLastLocalWalletPublicBalance,
} from './privacyChainCacheStore';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function createBackgroundApi() {
  let saved: unknown = null;
  const privacyChainCache = new SimpleDbEntityPrivacyChainCache();
  (privacyChainCache as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  return {
    simpleDb: { privacyChainCache },
  } as unknown as IBackgroundApi;
}

const owner = { networkId: 'xmr--0', accountId: 'hd-1--0' };

async function seed(backgroundApi: IBackgroundApi, value: string) {
  await readLocalWalletBalanceStaleFirst({
    backgroundApi,
    ...owner,
    read: async () => value,
  });
}

describe('saved privacy chain balance', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('waits for the scanner when nothing was saved yet', async () => {
    const backgroundApi = createBackgroundApi();
    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        ...owner,
        liveWaitMs: 0,
        read: async () => 'live',
      }),
    ).resolves.toEqual({ value: 'live', stale: false });
  });

  it('shows the saved balance when the scanner fails', async () => {
    const backgroundApi = createBackgroundApi();
    await seed(backgroundApi, 'saved');
    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        ...owner,
        read: async () => {
          throw new OneKeyLocalError('runtime down');
        },
      }),
    ).resolves.toEqual({ value: 'saved', stale: true });
  });

  // "Not scanning" is an answer, not a failure; an old figure must not
  // pretend otherwise.
  it('passes an authoritative "nothing" through', async () => {
    const backgroundApi = createBackgroundApi();
    await seed(backgroundApi, 'saved');
    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        ...owner,
        read: async () => null,
      }),
    ).resolves.toBeNull();
  });

  it('answers from disk without touching a busy scanner', async () => {
    const backgroundApi = createBackgroundApi();
    await seed(backgroundApi, 'saved');
    const read = jest.fn(async () => 'live');
    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        ...owner,
        skipLive: true,
        read,
      }),
    ).resolves.toEqual({ value: 'saved', stale: true });
    expect(read).not.toHaveBeenCalled();
  });

  it('shows the saved balance past the wait, then saves and announces the live one', async () => {
    const backgroundApi = createBackgroundApi();
    await seed(backgroundApi, 'saved');
    const emit = jest.spyOn(appEventBus, 'emit');
    let finish: (value: string) => void = () => {};
    const slow = new Promise<string>((resolve) => {
      finish = resolve;
    });

    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        ...owner,
        liveWaitMs: 0,
        read: () => slow,
      }),
    ).resolves.toEqual({ value: 'saved', stale: true });

    finish('live');
    await slow;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.RefreshTokenList,
      undefined,
    );
    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        ...owner,
        skipLive: true,
        read: async () => 'unused',
      }),
    ).resolves.toEqual({ value: 'live', stale: true });
  });

  it('never answers with a balance saved for another network', async () => {
    const backgroundApi = createBackgroundApi();
    await seed(backgroundApi, 'saved');
    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        networkId: 'zec--0',
        accountId: owner.accountId,
        skipLive: true,
        read: async () => 'unused',
      }),
    ).resolves.toBeNull();
  });

  it('drops one network without touching another', async () => {
    const backgroundApi = createBackgroundApi();
    await seed(backgroundApi, 'xmr');
    await readLocalWalletBalanceStaleFirst({
      backgroundApi,
      networkId: 'zec--0',
      accountId: 'hd-1--1',
      read: async () => 'zec',
    });

    await removeNetworkLastLocalWalletBalances({
      backgroundApi,
      networkId: 'xmr--0',
    });

    await expect(
      backgroundApi.simpleDb.privacyChainCache.listLastBalanceAccountIds(),
    ).resolves.toEqual(['hd-1--1']);
  });
});

describe('saved public-side balance', () => {
  const pair = { total: '80', spendable: '50' };

  it('is read back only for the network it was saved under', async () => {
    const backgroundApi = createBackgroundApi();
    await saveLastLocalWalletPublicBalance({
      backgroundApi,
      ...owner,
      value: pair,
    });
    await expect(
      readLastLocalWalletPublicBalance({ backgroundApi, ...owner }),
    ).resolves.toEqual(pair);
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi,
        networkId: 'zec--0',
        accountId: owner.accountId,
      }),
    ).resolves.toBeUndefined();
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi,
        networkId: owner.networkId,
        accountId: 'hd-1--1',
      }),
    ).resolves.toBeUndefined();
  });

  it('is cleared with the private balance', async () => {
    const backgroundApi = createBackgroundApi();
    await saveLastLocalWalletPublicBalance({
      backgroundApi,
      ...owner,
      value: pair,
    });
    await expect(
      backgroundApi.simpleDb.privacyChainCache.listLastBalanceAccountIds(),
    ).resolves.toEqual([owner.accountId]);

    await removeLastLocalWalletBalances({
      backgroundApi,
      accountIds: [owner.accountId],
    });
    await expect(
      readLastLocalWalletPublicBalance({ backgroundApi, ...owner }),
    ).resolves.toBeUndefined();

    await saveLastLocalWalletPublicBalance({
      backgroundApi,
      ...owner,
      value: pair,
    });
    await removeNetworkLastLocalWalletBalances({
      backgroundApi,
      networkId: owner.networkId,
    });
    await expect(
      readLastLocalWalletPublicBalance({ backgroundApi, ...owner }),
    ).resolves.toBeUndefined();
  });

  it('reads as nothing saved when the store is unavailable', async () => {
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi: {} as IBackgroundApi,
        ...owner,
      }),
    ).resolves.toBeUndefined();
  });
});
