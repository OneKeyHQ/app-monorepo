import { renderHook } from '@testing-library/react-native';

import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';

import { useDeFiOverviewTopN } from './useDeFiOverviewTopN';

const mk = (id: string): IDeFiProtocol =>
  ({
    protocol: id,
    owner: 'o',
    networkId: 'n',
    categories: [],
    positions: [],
  }) as IDeFiProtocol;

describe('useDeFiOverviewTopN', () => {
  const getNW =
    (map: Record<string, number>) =>
    (p: IDeFiProtocol): number =>
      map[p.protocol] ?? 0;

  it('returns empty when no protocols', () => {
    const { result } = renderHook(() =>
      useDeFiOverviewTopN(undefined, getNW({})),
    );
    expect(result.current).toEqual([]);

    const empty = renderHook(() => useDeFiOverviewTopN([], getNW({})));
    expect(empty.result.current).toEqual([]);
  });

  it('sorts by netWorth desc', () => {
    const protocols = [mk('a'), mk('b'), mk('c'), mk('d')];
    const values = { a: 10, b: 50, c: 30, d: 20 };
    const { result } = renderHook(() =>
      useDeFiOverviewTopN(protocols, getNW(values)),
    );
    expect(result.current.map((c) => c.protocol.protocol)).toEqual([
      'b',
      'c',
      'd',
      'a',
    ]);
    expect(result.current[0].netWorth).toBe(50);
  });
});
