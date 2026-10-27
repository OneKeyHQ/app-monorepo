/** @jest-environment jsdom */
/* eslint-disable import/first */

import { renderHook } from '@testing-library/react';

const mockStore = new Map<string, string>();

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getString: (key: string) => mockStore.get(key),
      set: (key: string, value: string) => {
        mockStore.set(key, value);
      },
    },
  },
}));

import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { useReferralPageTab } from './useReferralPageTab';

const KEY = EAppSyncStorageKeys.onekey_referral_last_page_tab;

describe('useReferralPageTab', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('opens the invite tab the first time', () => {
    const { result } = renderHook(() => useReferralPageTab(undefined));
    expect(result.current).toBe('invite');
    expect(mockStore.get(KEY)).toBe('invite');
  });

  it('reopens the last tab when the route names none', () => {
    mockStore.set(KEY, 'benefits');
    const { result } = renderHook(() => useReferralPageTab(undefined));
    expect(result.current).toBe('benefits');
  });

  it('keeps the tab the route asks for and remembers it', () => {
    mockStore.set(KEY, 'benefits');
    const { result } = renderHook(() => useReferralPageTab('invite'));
    expect(result.current).toBe('invite');
    expect(mockStore.get(KEY)).toBe('invite');
  });

  it('remembers a tab switch', () => {
    const { result, rerender } = renderHook(
      ({ tab }: { tab?: string }) => useReferralPageTab(tab),
      { initialProps: { tab: undefined as string | undefined } },
    );
    expect(result.current).toBe('invite');
    rerender({ tab: 'benefits' });
    expect(result.current).toBe('benefits');
    expect(mockStore.get(KEY)).toBe('benefits');
  });

  it('falls back to invite for an unknown stored value', () => {
    mockStore.set(KEY, 'unknown');
    const { result } = renderHook(() => useReferralPageTab(undefined));
    expect(result.current).toBe('invite');
  });
});
