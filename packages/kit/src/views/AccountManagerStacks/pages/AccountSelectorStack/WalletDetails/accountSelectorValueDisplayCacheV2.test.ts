import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import {
  ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_ROWS,
  ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_SCOPES,
  buildAccountSelectorValueDisplayScopeKeyV2,
  mergeAccountSelectorValueDisplayRowsV2,
  readAccountSelectorValueDisplayRowsV2,
  writeAccountSelectorValueDisplayCacheV2,
} from './accountSelectorValueDisplayCacheV2';

const mockListeners: [string, (payload?: unknown) => void][] = [];
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: {
    on: (name: string, listener: (payload?: unknown) => void) => {
      mockListeners.push([name, listener]);
    },
  },
}));
const emit = (name: EAppEventBusNames, payload?: unknown) =>
  mockListeners
    .filter(([listenerName]) => listenerName === name)
    .forEach(([, listener]) => listener(payload));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  prefixOf: (namespace: string) => `${namespace}:`,
  swrCacheNamespaces: { accountSelectorValues: 'accSelValues' },
  swrKeys: {
    accountSelectorValues: ({ walletId }: { walletId: string }) =>
      `accSelValues:v1:${walletId}`,
  },
  swrCacheUtils: {
    set: jest.fn(),
    remove: jest.fn(),
    removeByPrefix: jest.fn(),
    flushNow: jest.fn(),
  },
}));

const scopeKey = buildAccountSelectorValueDisplayScopeKeyV2({
  deriveType: 'default',
  selectedNetworkId: 'onekeyall--0',
});

const usd32 = { text: '$32.45', tone: 'secondary' as const };
const usd5 = { text: '$5.63', tone: 'secondary' as const };
const empty = { text: '--', tone: 'disabled' as const };

describe('account selector value display cache', () => {
  it('stores the displayed segments and reads them back in the same currency', () => {
    const cache = mergeAccountSelectorValueDisplayRowsV2({
      cache: undefined,
      scopeKey,
      currency: 'usd',
      locale: 'en-US',
      accountIds: ['hd-1--0', 'hd-1--1', 'hd-1--2'],
      liveRows: { 'hd-1--0': usd32, 'hd-1--1': usd5, 'hd-1--2': empty },
      now: 1,
    });

    expect(
      readAccountSelectorValueDisplayRowsV2({
        cache,
        scopeKey,
        currency: 'usd',
        locale: 'en-US',
        hideValue: false,
      }),
    ).toEqual({ 'hd-1--0': usd32, 'hd-1--1': usd5, 'hd-1--2': empty });
    expect(
      readAccountSelectorValueDisplayRowsV2({
        cache,
        scopeKey,
        currency: 'cny',
        locale: 'en-US',
        hideValue: false,
      }),
    ).toBeUndefined();
  });

  it('never reveals cached texts while balances are hidden', () => {
    const cache = mergeAccountSelectorValueDisplayRowsV2({
      cache: undefined,
      scopeKey,
      currency: 'usd',
      locale: 'en-US',
      accountIds: ['hd-1--0', 'hd-1--1'],
      liveRows: { 'hd-1--0': usd32, 'hd-1--1': empty },
      now: 1,
    });

    expect(
      readAccountSelectorValueDisplayRowsV2({
        cache,
        scopeKey,
        currency: 'usd',
        locale: 'en-US',
        hideValue: true,
      }),
    ).toEqual({
      'hd-1--0': { text: '****', tone: 'secondary' },
      'hd-1--1': { text: '****', tone: 'disabled' },
    });
  });

  it('keeps previous texts for accounts without a live segment and skips unchanged writes', () => {
    const first = mergeAccountSelectorValueDisplayRowsV2({
      cache: undefined,
      scopeKey,
      currency: 'usd',
      locale: 'en-US',
      accountIds: ['hd-1--0', 'hd-1--1'],
      liveRows: { 'hd-1--0': usd32, 'hd-1--1': usd5 },
      now: 1,
    });
    const partial = mergeAccountSelectorValueDisplayRowsV2({
      cache: first,
      scopeKey,
      currency: 'usd',
      locale: 'en-US',
      accountIds: ['hd-1--0', 'hd-1--1'],
      liveRows: { 'hd-1--0': usd32 },
      now: 2,
    });

    expect(partial).toBeUndefined();
    const updated = mergeAccountSelectorValueDisplayRowsV2({
      cache: first,
      scopeKey,
      currency: 'usd',
      locale: 'en-US',
      accountIds: ['hd-1--0', 'hd-1--1'],
      liveRows: { 'hd-1--0': { text: '$40.00', tone: 'secondary' } },
      now: 3,
    });
    expect(updated?.scopes[scopeKey].rows).toEqual({
      'hd-1--0': { text: '$40.00', tone: 'secondary' },
      'hd-1--1': usd5,
    });
  });

  it('bounds rows per scope and scopes per wallet', () => {
    const accountIds = Array.from(
      { length: ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_ROWS + 5 },
      (_, index) => `hd-1--${index}`,
    );
    let cache = mergeAccountSelectorValueDisplayRowsV2({
      cache: undefined,
      scopeKey,
      currency: 'usd',
      locale: 'en-US',
      accountIds,
      liveRows: Object.fromEntries(accountIds.map((id) => [id, usd5])),
      now: 1,
    });
    expect(Object.keys(cache?.scopes[scopeKey].rows ?? {})).toHaveLength(
      ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_ROWS,
    );

    for (
      let index = 0;
      index < ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_SCOPES + 1;
      index += 1
    ) {
      cache =
        mergeAccountSelectorValueDisplayRowsV2({
          cache,
          scopeKey: buildAccountSelectorValueDisplayScopeKeyV2({
            deriveType: 'default',
            selectedNetworkId: `evm--${index}`,
          }),
          currency: 'usd',
          locale: 'en-US',
          accountIds: ['hd-1--0'],
          liveRows: { 'hd-1--0': usd32 },
          now: 10 + index,
        }) ?? cache;
    }
    expect(Object.keys(cache?.scopes ?? {})).toHaveLength(
      ACCOUNT_SELECTOR_VALUE_DISPLAY_MAX_SCOPES,
    );
    expect(cache?.scopes[scopeKey]).toBeUndefined();
  });

  it('does not reuse texts formatted in another app locale', () => {
    const cache = mergeAccountSelectorValueDisplayRowsV2({
      cache: undefined,
      scopeKey,
      currency: 'usd',
      locale: 'en-US',
      accountIds: ['hd-1--0', 'hd-1--1'],
      liveRows: { 'hd-1--0': usd32, 'hd-1--1': usd5 },
      now: 1,
    });

    expect(
      readAccountSelectorValueDisplayRowsV2({
        cache,
        scopeKey,
        currency: 'usd',
        locale: 'de',
        hideValue: false,
      }),
    ).toBeUndefined();
    // Rows without a live text are not carried over from the other locale.
    const german = { text: '32,45 $', tone: 'secondary' as const };
    expect(
      mergeAccountSelectorValueDisplayRowsV2({
        cache,
        scopeKey,
        currency: 'usd',
        locale: 'de',
        accountIds: ['hd-1--0', 'hd-1--1'],
        liveRows: { 'hd-1--0': german },
        now: 2,
      })?.scopes[scopeKey],
    ).toEqual({
      currency: 'usd',
      locale: 'de',
      rows: { 'hd-1--0': german },
      t: 2,
    });
  });

  it('drops written entries in this runtime when wallets or accounts are removed', () => {
    writeAccountSelectorValueDisplayCacheV2('accSelValues:v1:hd-1', {
      scopes: {},
    });
    writeAccountSelectorValueDisplayCacheV2('accSelValues:v1:hd-2', {
      scopes: {},
    });
    expect(swrCacheUtils.set).toHaveBeenCalledTimes(2);
    // Listeners are registered once, on the first write.
    expect(mockListeners.map(([name]) => name)).toEqual([
      EAppEventBusNames.WalletRemove,
      EAppEventBusNames.AccountRemove,
      EAppEventBusNames.WalletClear,
    ]);

    emit(EAppEventBusNames.WalletRemove, { walletId: 'hd-1' });
    expect(swrCacheUtils.remove).toHaveBeenCalledWith('accSelValues:v1:hd-1');
    emit(EAppEventBusNames.AccountRemove);
    emit(EAppEventBusNames.WalletClear);
    expect(swrCacheUtils.removeByPrefix).toHaveBeenCalledTimes(2);
    expect(swrCacheUtils.removeByPrefix).toHaveBeenCalledWith('accSelValues:');
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(3);
  });

  it('ignores malformed cache payloads', () => {
    expect(
      readAccountSelectorValueDisplayRowsV2({
        cache: { scopes: { [scopeKey]: { currency: 'usd', rows: 'bad' } } },
        scopeKey,
        currency: 'usd',
        locale: 'en-US',
        hideValue: false,
      }),
    ).toBeUndefined();
    expect(
      readAccountSelectorValueDisplayRowsV2({
        cache: {
          scopes: {
            [scopeKey]: {
              currency: 'usd',
              locale: 'en-US',
              rows: { 'hd-1--0': { tone: 'secondary' }, 'hd-1--1': usd5 },
              t: 1,
            },
          },
        },
        scopeKey,
        currency: 'usd',
        locale: 'en-US',
        hideValue: false,
      }),
    ).toEqual({ 'hd-1--1': usd5 });
  });
});
