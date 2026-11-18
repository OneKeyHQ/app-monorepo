/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import type { IInviteRewardScope } from '@onekeyhq/shared/src/referralCode/type';

import { useInviteRewardScopes } from './useInviteRewardScopes';

let mockLocale: ILocaleSymbol = 'en';

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => mockLocale,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceReferralCode: { getInviteRewardScopes: jest.fn() } },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise')
    .useDeferredPromise,
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));

const ENGLISH = [{ subject: 'Swap', description: 'en-scope' }];
const CHINESE = [{ subject: 'Swap', description: 'zh-CN-scope' }];
const getScopes = jest.spyOn(
  backgroundApiProxy.serviceReferralCode,
  'getInviteRewardScopes',
);

function deferredScopes() {
  let resolve!: (scopes: IInviteRewardScope[]) => void;
  const promise = new Promise<IInviteRewardScope[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('useInviteRewardScopes locale changes', () => {
  beforeEach(() => {
    mockLocale = 'en';
    getScopes.mockReset();
  });

  it('hides the previous language while requesting the new language', async () => {
    const next = deferredScopes();
    getScopes.mockResolvedValueOnce(ENGLISH).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(() => useInviteRewardScopes());
    await waitFor(() => expect(result.current).toEqual(ENGLISH));

    mockLocale = 'zh-CN';
    rerender();
    expect(result.current).toEqual([]);
    await waitFor(() => expect(getScopes).toHaveBeenCalledTimes(2));
    await act(async () => next.resolve(CHINESE));
    expect(result.current).toEqual(CHINESE);
  });

  it('ignores a previous language response that arrives after the new one', async () => {
    const previous = deferredScopes();
    getScopes
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(CHINESE);
    const { result, rerender } = renderHook(() => useInviteRewardScopes());
    await waitFor(() => expect(getScopes).toHaveBeenCalledTimes(1));

    mockLocale = 'zh-CN';
    rerender();
    await waitFor(() => expect(result.current).toEqual(CHINESE));
    await act(async () => previous.resolve(ENGLISH));
    expect(result.current).toEqual(CHINESE);
  });

  it('does not restore the previous language when the new request fails', async () => {
    getScopes
      .mockResolvedValueOnce(ENGLISH)
      .mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(() => useInviteRewardScopes());
    await waitFor(() => expect(result.current).toEqual(ENGLISH));

    mockLocale = 'zh-CN';
    rerender();
    await waitFor(() => expect(getScopes).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual([]);
  });
});
