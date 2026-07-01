import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { selectVisibleHistoryRows } from './historyTopFreezeUtils';

function tx(id: string): IAccountHistoryTx {
  return { id } as unknown as IAccountHistoryTx;
}

function idSet(...ids: string[]): Set<string> {
  return new Set(ids);
}

describe('selectVisibleHistoryRows', () => {
  const combined = [tx('X'), tx('A'), tx('B'), tx('C')];

  it('returns the live list when the gate is disabled', () => {
    expect(
      selectVisibleHistoryRows({
        combined,
        displayedIds: idSet('A', 'B', 'C'),
        isAwayFromTop: true,
        enabled: false,
      }),
    ).toBe(combined);
  });

  it('returns the live list when the user is at/near the top', () => {
    expect(
      selectVisibleHistoryRows({
        combined,
        displayedIds: idSet('A', 'B', 'C'),
        isAwayFromTop: false,
        enabled: true,
      }),
    ).toBe(combined);
  });

  it('returns the live list when combined is empty', () => {
    const empty: IAccountHistoryTx[] = [];
    expect(
      selectVisibleHistoryRows({
        combined: empty,
        displayedIds: idSet('A'),
        isAwayFromTop: true,
        enabled: true,
      }),
    ).toBe(empty);
  });

  it('holds back a single freshly prepended top row while scrolled away', () => {
    const result = selectVisibleHistoryRows({
      combined,
      displayedIds: idSet('A', 'B', 'C'),
      isAwayFromTop: true,
      enabled: true,
    });
    expect(result.map((t) => t.id)).toEqual(['A', 'B', 'C']);
  });

  it('holds back multiple new top rows accumulated across refreshes', () => {
    const grown = [tx('Y'), tx('X'), tx('A'), tx('B'), tx('C')];
    const result = selectVisibleHistoryRows({
      // displayed already excludes X (held on a previous tick)
      combined: grown,
      displayedIds: idSet('A', 'B', 'C'),
      isAwayFromTop: true,
      enabled: true,
    });
    expect(result.map((t) => t.id)).toEqual(['A', 'B', 'C']);
  });

  it('still renders bottom growth from load-more while the top is frozen', () => {
    // 'X' is a new top row; 'D' was appended at the bottom by load-more.
    const grown = [tx('X'), tx('A'), tx('B'), tx('C'), tx('D')];
    const result = selectVisibleHistoryRows({
      combined: grown,
      displayedIds: idSet('A', 'B', 'C'),
      isAwayFromTop: true,
      enabled: true,
    });
    expect(result.map((t) => t.id)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns the live list (with bottom growth) when nothing new is prepended', () => {
    const grown = [tx('A'), tx('B'), tx('C'), tx('D')];
    const result = selectVisibleHistoryRows({
      combined: grown,
      displayedIds: idSet('A', 'B', 'C'),
      isAwayFromTop: true,
      enabled: true,
    });
    expect(result).toBe(grown);
  });

  it('holds back a new row inserted below a row that stays at the top', () => {
    // 'P' is a long-lived local pending that keeps index 0 across refreshes;
    // 'N' is a new tx a refresh inserted right below it (still above the
    // viewport). A strict-prefix anchor would stop at 'P' and leak 'N' through.
    const grown = [tx('P'), tx('N'), tx('A'), tx('B'), tx('C')];
    const result = selectVisibleHistoryRows({
      combined: grown,
      displayedIds: idSet('P', 'A', 'B', 'C'),
      isAwayFromTop: true,
      enabled: true,
    });
    expect(result.map((t) => t.id)).toEqual(['P', 'A', 'B', 'C']);
  });

  it('holds back a mid-block insertion while keeping bottom growth', () => {
    // 'N' inserted between displayed rows (above viewport) must be held back;
    // 'D' appended at the bottom by load-more must still render.
    const grown = [tx('P'), tx('N'), tx('A'), tx('B'), tx('C'), tx('D')];
    const result = selectVisibleHistoryRows({
      combined: grown,
      displayedIds: idSet('P', 'A', 'B', 'C'),
      isAwayFromTop: true,
      enabled: true,
    });
    expect(result.map((t) => t.id)).toEqual(['P', 'A', 'B', 'C', 'D']);
  });

  it('refreshes displayed rows in place when ids are unchanged (bg re-serialization)', () => {
    // Same ids, brand-new objects (bg -> main hop): must reflect the new
    // objects, not stale references, without inserting anything at the top.
    const refreshed = [tx('A'), tx('B'), tx('C')];
    const result = selectVisibleHistoryRows({
      combined: refreshed,
      displayedIds: idSet('A', 'B', 'C'),
      isAwayFromTop: true,
      enabled: true,
    });
    expect(result).toBe(refreshed);
  });

  it('renders live on a wholesale replacement (no displayed row survives)', () => {
    const replaced = [tx('P'), tx('Q')];
    expect(
      selectVisibleHistoryRows({
        combined: replaced,
        displayedIds: idSet('A', 'B', 'C'),
        isAwayFromTop: true,
        enabled: true,
      }),
    ).toBe(replaced);
  });
});
