/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useLoadedOnce } from './useLoadedOnce';

describe('useLoadedOnce', () => {
  it('keeps a loaded value through a same-scope polling gap', () => {
    const { result, rerender } = renderHook(
      ({ hasData, scopeKey }) => useLoadedOnce(hasData, scopeKey),
      { initialProps: { hasData: false, scopeKey: 'market-a:account-a' } },
    );

    expect(result.current).toBe(false);
    rerender({ hasData: true, scopeKey: 'market-a:account-a' });
    expect(result.current).toBe(true);
    rerender({ hasData: false, scopeKey: 'market-a:account-a' });
    expect(result.current).toBe(true);
  });

  it('resets during the render that changes market or account', () => {
    const { result, rerender } = renderHook(
      ({ hasData, scopeKey }) => useLoadedOnce(hasData, scopeKey),
      { initialProps: { hasData: true, scopeKey: 'market-a:account-a' } },
    );

    rerender({ hasData: false, scopeKey: 'market-b:account-a' });
    expect(result.current).toBe(false);
    rerender({ hasData: true, scopeKey: 'market-b:account-a' });
    expect(result.current).toBe(true);
    rerender({ hasData: false, scopeKey: 'market-b:account-b' });
    expect(result.current).toBe(false);
    rerender({ hasData: false, scopeKey: 'market-a:account-a' });
    expect(result.current).toBe(false);
  });
});
