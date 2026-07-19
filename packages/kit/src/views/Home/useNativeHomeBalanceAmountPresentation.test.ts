import { act, renderHook } from '@testing-library/react-native';

import type { ICurrencyItem } from '@onekeyhq/shared/types';

import { resolveNativeHomeHeaderActionPresentation } from './nativeHomeBalanceAuthority';
import {
  type INativeHomeConfirmedBalanceCache,
  applyNativeHomeBalanceAmountCommit,
  convertNativeHomeBalanceUsdToDisplay,
  convertNativeHomeConfirmedBalanceToUsd,
  resolveNativeHomeBalanceAmountPresentation,
  useNativeHomeBalanceAmountPresentation,
} from './useNativeHomeBalanceAmountPresentation';

const scopeA = 'wallet-a__account-a__network-a';
const scopeB = 'wallet-a__account-b__network-a';

const success = (scopeKey: string, included = true) => ({
  included,
  scopeKey,
  status: 'success' as const,
});
const loading = (scopeKey: string | undefined, included = true) => ({
  included,
  scopeKey,
  status: 'loading' as const,
});
const error = (scopeKey: string | undefined, included = true) => ({
  included,
  scopeKey,
  status: 'error' as const,
});

const currencyMap: Record<string, ICurrencyItem> = {
  cny: {
    id: 'cny',
    unit: '¥',
    name: 'Chinese Yuan',
    type: ['fiat'],
    value: '7',
  },
  eur: {
    id: 'eur',
    unit: '€',
    name: 'Euro',
    type: ['fiat'],
    value: '0.8',
  },
  usd: {
    id: 'usd',
    unit: '$',
    name: 'US Dollar',
    type: ['fiat'],
    value: '1',
  },
};

function resolve({
  confirmedValueUsd,
  deFi = success(scopeB),
  liveValueUsd = '7',
  ownerKey = 'account-b__network-a',
  perps = success(scopeB, false),
  portfolio = success(scopeB),
  scopeKey = scopeB,
}: Partial<
  Parameters<typeof resolveNativeHomeBalanceAmountPresentation>[0]
> = {}) {
  return resolveNativeHomeBalanceAmountPresentation({
    confirmedValueUsd,
    deFi,
    liveValueUsd,
    ownerKey,
    perps,
    portfolio,
    scopeKey,
  });
}

describe('resolveNativeHomeBalanceAmountPresentation', () => {
  it('holds an exact confirmed amount instead of a partial live sum', () => {
    expect(
      resolve({
        confirmedValueUsd: '12',
        deFi: loading(scopeB),
        liveValueUsd: '4',
      }),
    ).toEqual({
      commit: undefined,
      presentation: { status: 'confirmed', valueUsd: '12' },
    });
  });

  it('uses a skeleton without an exact cache and never guesses zero', () => {
    expect(
      resolve({
        confirmedValueUsd: undefined,
        deFi: loading(scopeB),
        liveValueUsd: '0',
      }),
    ).toEqual({
      commit: undefined,
      presentation: { status: 'loading', valueUsd: undefined },
    });
  });

  it('commits one final value only after every included source is current and successful', () => {
    expect(
      resolve({
        deFi: success(scopeB),
        liveValueUsd: '15',
        perps: success(scopeB),
        portfolio: success(scopeB),
      }),
    ).toEqual({
      commit: {
        ownerKey: 'account-b__network-a',
        scopeKey: scopeB,
        valueUsd: '15',
      },
      presentation: { status: 'final', valueUsd: '15' },
    });
  });

  it('rejects stale DeFi or included Perps authority while allowing excluded Perps', () => {
    expect(
      resolve({
        confirmedValueUsd: '9',
        deFi: success(scopeA),
        liveValueUsd: '3',
      }).presentation,
    ).toEqual({ status: 'confirmed', valueUsd: '9' });
    expect(
      resolve({
        deFi: success(scopeB),
        perps: loading(scopeB),
      }).presentation.status,
    ).toBe('loading');
    expect(
      resolve({
        deFi: success(scopeB),
        perps: loading(scopeB, false),
      }).presentation.status,
    ).toBe('final');
  });

  it('holds exact cache on error and keeps no-cache errors loading', () => {
    expect(
      resolve({
        confirmedValueUsd: '9',
        deFi: error(scopeB),
        liveValueUsd: '0',
      }).presentation,
    ).toEqual({ status: 'confirmed', valueUsd: '9' });
    expect(
      resolve({
        confirmedValueUsd: undefined,
        deFi: error(scopeB),
        liveValueUsd: '0',
      }).presentation,
    ).toEqual({ status: 'loading', valueUsd: undefined });
  });

  it('normalizes cache currency through USD and converts once for display', () => {
    const valueUsd = convertNativeHomeConfirmedBalanceToUsd({
      confirmedCurrency: 'eur',
      confirmedValue: '80',
      currencyMap,
      displayCurrency: 'cny',
    });
    expect(valueUsd).toBe('100');
    expect(
      convertNativeHomeBalanceUsdToDisplay({
        currencyMap,
        displayCurrency: 'cny',
        valueUsd,
      }),
    ).toBe('700');
    const invalidValueUsd = convertNativeHomeConfirmedBalanceToUsd({
      confirmedCurrency: 'eur',
      confirmedValue: '--',
      currencyMap,
      displayCurrency: 'cny',
    });
    expect(invalidValueUsd).toBeUndefined();
    expect(
      resolve({
        confirmedValueUsd: invalidValueUsd,
        deFi: loading(scopeB),
        liveValueUsd: '0',
      }),
    ).toEqual({
      commit: undefined,
      presentation: { status: 'loading', valueUsd: undefined },
    });
  });

  it('writes final USD to only the exact owner while preserving other owners', () => {
    const migrated = applyNativeHomeBalanceAmountCommit(
      {
        byOwner: { 'account-a__network-a': '12' },
        currency: 'eur',
        latest: '12',
      },
      { ownerKey: 'account-b__network-a', valueUsd: '54.59' },
      { currencyMap, displayCurrency: 'cny' },
    );
    expect(migrated).toEqual({
      byOwner: {
        'account-a__network-a': '15',
        'account-b__network-a': '54.59',
      },
      currency: 'usd',
      latest: '54.59',
    });
    expect(
      applyNativeHomeBalanceAmountCommit(
        migrated,
        { ownerKey: 'account-b__network-a', valueUsd: '54.59' },
        { currencyMap, displayCurrency: 'cny' },
      ),
    ).toEqual(migrated);
  });

  it('uses display currency for legacy cache and preserves invalid owners', () => {
    expect(
      applyNativeHomeBalanceAmountCommit(
        {
          byOwner: {
            'account-a__network-a': '14',
            invalid: '--',
          },
          latest: '14',
        },
        { ownerKey: 'account-b__network-a', valueUsd: '3' },
        { currencyMap, displayCurrency: 'cny' },
      ),
    ).toEqual({
      byOwner: {
        'account-a__network-a': '2',
        'account-b__network-a': '3',
        invalid: '--',
      },
      currency: 'usd',
      latest: '3',
    });
  });
});

describe('useNativeHomeBalanceAmountPresentation', () => {
  it('keeps one mounted owner isolated and commits the new scope only when final', async () => {
    const onCommit = jest.fn();
    type IHookProps = Omit<
      Parameters<typeof useNativeHomeBalanceAmountPresentation>[0],
      'onCommit'
    >;
    const ownerAProps: IHookProps = {
      confirmedValueUsd: '12',
      deFi: success(scopeA),
      liveValueUsd: '12',
      ownerKey: 'account-a__network-a',
      perps: success(scopeA, false),
      portfolio: success(scopeA),
      scopeKey: scopeA,
    };
    const ownerBLoadingProps: IHookProps = {
      confirmedValueUsd: undefined,
      deFi: loading(scopeB),
      liveValueUsd: '4',
      ownerKey: 'account-b__network-a',
      perps: success(scopeB, false),
      portfolio: success(scopeB),
      scopeKey: scopeB,
    };
    const { result, rerender } = renderHook(
      (props: IHookProps) =>
        useNativeHomeBalanceAmountPresentation({ ...props, onCommit }),
      { initialProps: ownerAProps },
    );
    expect(result.current).toEqual({ status: 'final', valueUsd: '12' });
    expect(onCommit).toHaveBeenLastCalledWith({
      ownerKey: 'account-a__network-a',
      scopeKey: scopeA,
      valueUsd: '12',
    });
    onCommit.mockClear();

    await act(async () => {
      rerender(ownerBLoadingProps);
      await Promise.resolve();
    });
    expect(result.current).toEqual({
      status: 'loading',
      valueUsd: undefined,
    });
    expect(onCommit).not.toHaveBeenCalled();

    await act(async () => {
      rerender({
        ...ownerBLoadingProps,
        deFi: success(scopeA),
        liveValueUsd: '99',
      });
      await Promise.resolve();
    });
    expect(result.current.status).toBe('loading');
    expect(onCommit).not.toHaveBeenCalled();

    await act(async () => {
      rerender({
        ...ownerBLoadingProps,
        deFi: success(scopeB),
        liveValueUsd: '0',
      });
      await Promise.resolve();
    });
    expect(result.current).toEqual({ status: 'final', valueUsd: '0' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      ownerKey: 'account-b__network-a',
      scopeKey: scopeB,
      valueUsd: '0',
    });
  });

  it('keeps positive actions independent while holding progressive amount until one final commit', async () => {
    const onCommit = jest.fn();
    type IHookProps = Omit<
      Parameters<typeof useNativeHomeBalanceAmountPresentation>[0],
      'onCommit'
    >;
    const initialProps: IHookProps = {
      confirmedValueUsd: undefined,
      deFi: loading(scopeB),
      liveValueUsd: '0',
      ownerKey: 'account-b__network-a',
      perps: success(scopeB, false),
      portfolio: success(scopeB),
      scopeKey: scopeB,
    };
    const { result, rerender } = renderHook(
      (props: IHookProps) =>
        useNativeHomeBalanceAmountPresentation({ ...props, onCommit }),
      { initialProps },
    );
    expect(resolveNativeHomeHeaderActionPresentation('positive')).toEqual({
      actionLayout: 'standard',
      rowHeight: 62,
      slotKind: 'positive',
    });
    expect(result.current).toEqual({
      status: 'loading',
      valueUsd: undefined,
    });

    for (const liveValueUsd of ['10.26', '33.92', '47.17']) {
      await act(async () => {
        rerender({
          ...initialProps,
          confirmedValueUsd: '43.71',
          liveValueUsd,
        });
        await Promise.resolve();
      });
      expect(result.current).toEqual({
        status: 'confirmed',
        valueUsd: '43.71',
      });
      expect(onCommit).not.toHaveBeenCalled();
    }

    await act(async () => {
      rerender({
        ...initialProps,
        confirmedValueUsd: '43.71',
        deFi: success(scopeB),
        liveValueUsd: '54.59',
      });
      await Promise.resolve();
    });
    expect(result.current).toEqual({
      status: 'final',
      valueUsd: '54.59',
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      ownerKey: 'account-b__network-a',
      scopeKey: scopeB,
      valueUsd: '54.59',
    });

    await act(async () => {
      rerender({
        ...initialProps,
        confirmedValueUsd: '54.59',
        deFi: success(scopeB),
        liveValueUsd: '54.59',
      });
      await Promise.resolve();
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('migrates the owner map once and reads the prior owner back in USD', async () => {
    let cache: INativeHomeConfirmedBalanceCache = {
      byOwner: { 'account-a__network-a': '12' },
      currency: 'eur',
      latest: '12',
    };
    const onCommit = jest.fn(
      (commit: Parameters<typeof applyNativeHomeBalanceAmountCommit>[1]) => {
        cache = applyNativeHomeBalanceAmountCommit(cache, commit, {
          currencyMap,
          displayCurrency: 'cny',
        });
      },
    );
    type IHookProps = Omit<
      Parameters<typeof useNativeHomeBalanceAmountPresentation>[0],
      'onCommit'
    >;
    const ownerBFinal: IHookProps = {
      confirmedValueUsd: undefined,
      deFi: success(scopeB),
      liveValueUsd: '54.59',
      ownerKey: 'account-b__network-a',
      perps: success(scopeB, false),
      portfolio: success(scopeB),
      scopeKey: scopeB,
    };
    const { result, rerender } = renderHook(
      (props: IHookProps) =>
        useNativeHomeBalanceAmountPresentation({ ...props, onCommit }),
      { initialProps: ownerBFinal },
    );
    expect(cache).toEqual({
      byOwner: {
        'account-a__network-a': '15',
        'account-b__network-a': '54.59',
      },
      currency: 'usd',
      latest: '54.59',
    });

    await act(async () => {
      rerender(ownerBFinal);
      await Promise.resolve();
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(cache.byOwner['account-a__network-a']).toBe('15');

    await act(async () => {
      rerender({
        confirmedValueUsd: cache.byOwner['account-a__network-a'],
        deFi: loading(scopeA),
        liveValueUsd: '0',
        ownerKey: 'account-a__network-a',
        perps: success(scopeA, false),
        portfolio: success(scopeA),
        scopeKey: scopeA,
      });
      await Promise.resolve();
    });
    expect(result.current).toEqual({ status: 'confirmed', valueUsd: '15' });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
