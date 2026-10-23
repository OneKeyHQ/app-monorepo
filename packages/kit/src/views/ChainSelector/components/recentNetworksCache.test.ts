import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { RECENT_NETWORKS_LIMIT } from '@onekeyhq/shared/src/consts/networkConsts';
import { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import {
  buildRecentNetworksSwrKey,
  prependRecentNetworkToSwrCache,
} from './recentNetworksCache';

const network = (id: string, name = id): IServerNetwork =>
  ({ id, name }) as unknown as IServerNetwork;

const scope = EAppSWRCacheScopes.editableChainSelector;

describe('buildRecentNetworksSwrKey', () => {
  it('keeps one slot per HD wallet across its per-network account ids (OK-65230)', () => {
    const evm = buildRecentNetworksSwrKey({
      scope,
      showAllNetwork: true,
      walletId: 'hd-1',
      accountId: "hd-1--m/44'/60'/0'/0/0",
    });
    const sol = buildRecentNetworksSwrKey({
      scope,
      showAllNetwork: true,
      walletId: 'hd-1',
      accountId: "hd-1--m/44'/501'/0'/0'",
    });
    expect(evm).toBe(sol);
    expect(evm).toContain('hd-1');
  });

  it('separates wallets and the showAllNetwork variants', () => {
    const base = { scope, showAllNetwork: true, walletId: 'hd-1' };
    expect(buildRecentNetworksSwrKey(base)).not.toBe(
      buildRecentNetworksSwrKey({ ...base, walletId: 'hw-1' }),
    );
    expect(buildRecentNetworksSwrKey(base)).not.toBe(
      buildRecentNetworksSwrKey({ ...base, showAllNetwork: false }),
    );
  });

  it('scopes others wallets by account because their network set is per account', () => {
    const a = buildRecentNetworksSwrKey({
      scope,
      showAllNetwork: true,
      walletId: 'imported',
      accountId: 'imported--60--0xaaa',
    });
    const b = buildRecentNetworksSwrKey({
      scope,
      showAllNetwork: true,
      walletId: 'imported',
      accountId: 'imported--501--bbb',
    });
    expect(a).not.toBe(b);
  });
});

describe('prependRecentNetworkToSwrCache', () => {
  const key = buildRecentNetworksSwrKey({
    scope,
    showAllNetwork: true,
    walletId: 'hd-1',
  });

  beforeEach(() => {
    swrCacheUtils.clearAll();
  });

  afterAll(() => {
    // Drain the debounced persist so no timer fires after teardown.
    swrCacheUtils.flushNow();
  });

  it('moves the network being left to the front of a warm slot', () => {
    swrCacheUtils.set(key, [network('sol'), network('evm--1'), network('btc')]);
    prependRecentNetworkToSwrCache({
      swrKey: key,
      network: network('evm--1', 'Ethereum'),
      showAllNetwork: true,
    });
    expect(swrCacheUtils.get<IServerNetwork[]>(key)?.map((n) => n.id)).toEqual([
      'evm--1',
      'sol',
      'btc',
    ]);
  });

  it('caps the slot at the recents limit', () => {
    const cached = Array.from({ length: RECENT_NETWORKS_LIMIT }, (_, i) =>
      network(`n${i}`),
    );
    swrCacheUtils.set(key, cached);
    prependRecentNetworkToSwrCache({
      swrKey: key,
      network: network('fresh'),
      showAllNetwork: true,
    });
    const ids = swrCacheUtils.get<IServerNetwork[]>(key)?.map((n) => n.id);
    expect(ids).toHaveLength(RECENT_NETWORKS_LIMIT);
    expect(ids?.[0]).toBe('fresh');
    expect(ids).not.toContain(`n${RECENT_NETWORKS_LIMIT - 1}`);
  });

  it('leaves a cold slot alone so the fetch fills it', () => {
    prependRecentNetworkToSwrCache({
      swrKey: key,
      network: network('evm--1'),
      showAllNetwork: true,
    });
    expect(swrCacheUtils.get(key)).toBeUndefined();
  });

  it('skips All Networks when the surface hides it', () => {
    swrCacheUtils.set(key, [network('sol')]);
    prependRecentNetworkToSwrCache({
      swrKey: key,
      network: network(getNetworkIdsMap().onekeyall),
      showAllNetwork: false,
    });
    expect(swrCacheUtils.get<IServerNetwork[]>(key)?.map((n) => n.id)).toEqual([
      'sol',
    ]);
  });

  it('is a no-op without a key', () => {
    expect(() =>
      prependRecentNetworkToSwrCache({
        swrKey: undefined,
        network: network('sol'),
        showAllNetwork: true,
      }),
    ).not.toThrow();
  });
});
