/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT } from '@onekeyhq/shared/types/linkConfig';
import type { ILinkConfigItem } from '@onekeyhq/shared/types/linkConfig';

import {
  fetchPrimeGiftClaimSuccessLinks,
  pickPrimeGiftClaimSuccessLink,
  resolveLinkConfigRequestLocale,
  usePrimeGiftClaimSuccessLink,
} from './usePrimeGiftClaimSuccessLink';

const zhItem: ILinkConfigItem = {
  linkId: 'pro2_prime_claim_success_test',
  title: '中文标题',
  description: '中文正文',
  mode: 3,
  payload: 'https://onekey.so/',
  image: null,
};
const enItem: ILinkConfigItem = {
  ...zhItem,
  title: 'English title',
  description: 'English description',
};

const mockFetch = jest.fn<Promise<ILinkConfigItem[]>, [{ slots: string[] }]>();
let mockLocale = 'zh-CN';
let lastPromiseDeps: unknown[] = [];
let lastPromiseMethod: (() => Promise<ILinkConfigItem[]>) | undefined;
let mockResult: ILinkConfigItem[] = [];
let mockLoading = false;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSetting: {
      fetchGetStartedLinks: (...args: unknown[]) => mockFetch(...args),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ locale: mockLocale }],
}));

jest.mock('@onekeyhq/shared/src/locale/getDefaultLocale', () => ({
  getDefaultLocale: () => 'en-US',
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<ILinkConfigItem[]>,
    deps: unknown[],
    options: { initResult: ILinkConfigItem[] },
  ) => {
    lastPromiseMethod = method;
    lastPromiseDeps = deps;
    return {
      result: mockResult.length ? mockResult : options.initResult,
      isLoading: mockLoading,
    };
  },
}));

describe('fetchPrimeGiftClaimSuccessLinks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('requests the claim-success slot from the selected Utility client', async () => {
    mockFetch.mockResolvedValue([zhItem]);
    await expect(fetchPrimeGiftClaimSuccessLinks()).resolves.toEqual([zhItem]);
    expect(mockFetch).toHaveBeenCalledWith({
      slots: [PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT],
    });
  });

  it('returns an empty list when the request fails', async () => {
    mockFetch.mockRejectedValue(new Error('utility unavailable'));
    await expect(fetchPrimeGiftClaimSuccessLinks()).resolves.toEqual([]);
  });
});

describe('resolveLinkConfigRequestLocale', () => {
  it('resolves system to the same default locale the request interceptor uses', () => {
    expect(resolveLinkConfigRequestLocale('system')).toBe('en-US');
    expect(resolveLinkConfigRequestLocale(undefined)).toBe('en-US');
  });

  it('keeps an explicit app locale', () => {
    expect(resolveLinkConfigRequestLocale('zh-CN')).toBe('zh-CN');
  });
});

describe('pickPrimeGiftClaimSuccessLink', () => {
  it('returns the first item and ignores an empty list', () => {
    expect(pickPrimeGiftClaimSuccessLink([zhItem, enItem])).toBe(zhItem);
    expect(pickPrimeGiftClaimSuccessLink([])).toBeUndefined();
    expect(pickPrimeGiftClaimSuccessLink(undefined)).toBeUndefined();
  });
});

describe('usePrimeGiftClaimSuccessLink', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockLocale = 'zh-CN';
    mockResult = [];
    mockLoading = false;
    lastPromiseDeps = [];
    lastPromiseMethod = undefined;
  });

  it('refetches when the active locale changes', async () => {
    mockFetch.mockResolvedValueOnce([zhItem]).mockResolvedValueOnce([enItem]);
    const { rerender } = renderHook(() => usePrimeGiftClaimSuccessLink());
    expect(lastPromiseDeps).toEqual([undefined, 'zh-CN']);
    await expect(lastPromiseMethod?.()).resolves.toEqual([zhItem]);

    mockLocale = 'en-US';
    rerender();
    expect(lastPromiseDeps).toEqual([undefined, 'en-US']);
    await expect(lastPromiseMethod?.()).resolves.toEqual([enItem]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('uses a gallery override and does not call Utility', async () => {
    const override = [enItem];
    const { result } = renderHook(() =>
      usePrimeGiftClaimSuccessLink(override),
    );
    expect(result.current).toBe(enItem);
    await expect(lastPromiseMethod?.()).resolves.toBe(override);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('hides the banner while the live request is loading', () => {
    mockResult = [zhItem];
    mockLoading = true;
    const { result } = renderHook(() => usePrimeGiftClaimSuccessLink());
    expect(result.current).toBeUndefined();
  });
});
