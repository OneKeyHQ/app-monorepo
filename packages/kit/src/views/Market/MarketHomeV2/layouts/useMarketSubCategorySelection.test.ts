/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useMarketSubCategorySelection } from './useMarketSubCategorySelection';

import type { IMarketCategoryItem } from '../types';

const ALL: IMarketCategoryItem = { id: 'all', name: 'All' };
const CHAINS: IMarketCategoryItem = {
  id: 'market_l1_l2_chains',
  name: 'L1 / L2',
};
const DEFI: IMarketCategoryItem = {
  id: 'market_defi_and_infra',
  name: 'DeFi',
};

describe('useMarketSubCategorySelection', () => {
  it('defaults to all before and after the config loads', () => {
    const { result, rerender } = renderHook(
      ({ categories }) => useMarketSubCategorySelection(categories),
      { initialProps: { categories: [] as IMarketCategoryItem[] } },
    );
    expect(result.current[0]).toBe('all');

    rerender({ categories: [ALL, CHAINS, DEFI] });
    expect(result.current[0]).toBe('all');
  });

  it('falls back to the first category when the config has no all', () => {
    const { result } = renderHook(() =>
      useMarketSubCategorySelection([CHAINS, DEFI]),
    );
    expect(result.current[0]).toBe('market_l1_l2_chains');
  });

  it('keeps a selection that is still configured and resets a removed one', () => {
    const { result, rerender } = renderHook(
      ({ categories }) => useMarketSubCategorySelection(categories),
      { initialProps: { categories: [ALL, CHAINS, DEFI] } },
    );
    act(() => result.current[1]('market_defi_and_infra'));
    expect(result.current[0]).toBe('market_defi_and_infra');

    rerender({ categories: [ALL, DEFI] });
    expect(result.current[0]).toBe('market_defi_and_infra');

    rerender({ categories: [ALL, CHAINS] });
    expect(result.current[0]).toBe('all');

    act(() => result.current[1]('market_l1_l2_chains'));
    rerender({ categories: [] });
    expect(result.current[0]).toBe('all');
  });
});
