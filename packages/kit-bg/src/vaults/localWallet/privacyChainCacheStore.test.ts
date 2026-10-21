import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { SimpleDbEntityPrivacyChainCache } from '../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import { SimpleDbEntityPrivacyChainState } from '../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

import {
  readLastLocalWalletPublicBalance,
  readLocalWalletBalanceStaleFirst,
  readLocalWalletCacheEpoch,
  removeLastLocalWalletBalances,
  removeNetworkLastLocalWalletBalances,
  saveLastLocalWalletBalance,
  saveLastLocalWalletPublicBalance,
} from './privacyChainCacheStore';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function memoryEntity<T extends object>(entity: T): T {
  let saved: unknown = null;
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

function createBackgroundApi() {
  return {
    simpleDb: {
      privacyChainCache: memoryEntity(new SimpleDbEntityPrivacyChainCache()),
      privacyChainState: memoryEntity(new SimpleDbEntityPrivacyChainState()),
    },
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
      epoch: undefined,
      value: pair,
    });
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi,
        ...owner,
        epoch: undefined,
      }),
    ).resolves.toEqual(pair);
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi,
        networkId: 'zec--0',
        accountId: owner.accountId,
        epoch: undefined,
      }),
    ).resolves.toBeUndefined();
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi,
        networkId: owner.networkId,
        accountId: 'hd-1--1',
        epoch: undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it('is cleared with the private balance', async () => {
    const backgroundApi = createBackgroundApi();
    await saveLastLocalWalletPublicBalance({
      backgroundApi,
      ...owner,
      epoch: undefined,
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
      readLastLocalWalletPublicBalance({
        backgroundApi,
        ...owner,
        epoch: undefined,
      }),
    ).resolves.toBeUndefined();

    await saveLastLocalWalletPublicBalance({
      backgroundApi,
      ...owner,
      epoch: undefined,
      value: pair,
    });
    await removeNetworkLastLocalWalletBalances({
      backgroundApi,
      networkId: owner.networkId,
    });
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi,
        ...owner,
        epoch: undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it('reads as nothing saved when the store is unavailable', async () => {
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi: {} as IBackgroundApi,
        ...owner,
        epoch: undefined,
      }),
    ).resolves.toBeUndefined();
  });
});

// The account's scanned data is destroyed (its epoch rotated) while a live
// read is in flight; the value that read returns describes destroyed data.
describe('saved balance epochs', () => {
  async function enable(backgroundApi: IBackgroundApi) {
    await backgroundApi.simpleDb.privacyChainState.beginXmrEnable({
      ...owner,
      birthdayHeight: 1,
    });
  }

  function savedRecord(backgroundApi: IBackgroundApi) {
    return backgroundApi.simpleDb.privacyChainCache.getLastBalance({
      accountId: owner.accountId,
    });
  }

  it('refuses a write-back whose read started before the epoch rotated', async () => {
    const backgroundApi = createBackgroundApi();
    await enable(backgroundApi);
    let finish: (value: string) => void = () => {};
    const slow = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const reading = readLocalWalletBalanceStaleFirst({
      backgroundApi,
      ...owner,
      read: () => slow,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Only the epoch moves: the cache's own gate must refuse the write.
    await backgroundApi.simpleDb.privacyChainState.rotateAccountEpochs({
      accountIds: [owner.accountId],
    });
    finish('destroyed');
    await expect(reading).resolves.toEqual({
      value: 'destroyed',
      stale: false,
    });
    await expect(savedRecord(backgroundApi)).resolves.toBeUndefined();
  });

  it('a value saved under the current epoch is kept', async () => {
    const backgroundApi = createBackgroundApi();
    await enable(backgroundApi);
    const epoch = await readLocalWalletCacheEpoch({
      backgroundApi,
      accountId: owner.accountId,
    });
    expect(epoch).toMatch(/^[0-9a-f]{16}$/);
    await saveLastLocalWalletBalance({
      backgroundApi,
      ...owner,
      epoch,
      value: 'current',
    });
    await expect(savedRecord(backgroundApi)).resolves.toMatchObject({
      epoch,
      value: JSON.stringify('current'),
    });
  });

  it('misses and deletes an entry saved under an older epoch', async () => {
    const backgroundApi = createBackgroundApi();
    await enable(backgroundApi);
    await seed(backgroundApi, 'old');
    await backgroundApi.simpleDb.privacyChainState.rotateAccountEpochs({
      accountIds: [owner.accountId],
    });
    await expect(
      readLocalWalletBalanceStaleFirst({
        backgroundApi,
        ...owner,
        skipLive: true,
        read: async () => 'unused',
      }),
    ).resolves.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(savedRecord(backgroundApi)).resolves.toBeUndefined();
  });

  it('reads a public pair saved before the account had an epoch', async () => {
    const backgroundApi = createBackgroundApi();
    const pair = { total: '80', spendable: '50' };
    await saveLastLocalWalletPublicBalance({
      backgroundApi,
      ...owner,
      epoch: undefined,
      value: pair,
    });
    await enable(backgroundApi);
    const epoch = await readLocalWalletCacheEpoch({
      backgroundApi,
      accountId: owner.accountId,
    });
    await expect(
      readLastLocalWalletPublicBalance({ backgroundApi, ...owner, epoch }),
    ).resolves.toEqual(pair);
  });

  it('misses a public pair saved under an older epoch', async () => {
    const backgroundApi = createBackgroundApi();
    const pair = { total: '80', spendable: '50' };
    await enable(backgroundApi);
    const before = await readLocalWalletCacheEpoch({
      backgroundApi,
      accountId: owner.accountId,
    });
    await saveLastLocalWalletPublicBalance({
      backgroundApi,
      ...owner,
      epoch: before,
      value: pair,
    });
    await backgroundApi.simpleDb.privacyChainState.rotateAccountEpochs({
      accountIds: [owner.accountId],
    });
    const after = await readLocalWalletCacheEpoch({
      backgroundApi,
      accountId: owner.accountId,
    });
    await expect(
      readLastLocalWalletPublicBalance({
        backgroundApi,
        ...owner,
        epoch: after,
      }),
    ).resolves.toBeUndefined();
  });
});
