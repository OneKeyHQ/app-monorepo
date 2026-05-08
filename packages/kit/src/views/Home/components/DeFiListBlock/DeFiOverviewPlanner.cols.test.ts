import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import {
  buildDeFiOverviewRenderCells,
  getOverviewCollapsedProtocolLimit,
} from './DeFiOverviewPlanner';

import type { IDeFiOverviewCell } from './hooks/useDeFiOverviewTopN';

function makeRanked(count: number, base = 1000): IDeFiOverviewCell[] {
  return Array.from({ length: count }, (_, i) => ({
    protocol: { protocol: `p${i}`, networkId: 'evm--1' } as IDeFiProtocol,
    netWorth: base - i,
  }));
}

function makeMap(count: number): Record<string, IProtocolSummary> {
  const map: Record<string, IProtocolSummary> = {};
  for (let i = 0; i < count; i += 1) {
    const key = defiUtils.buildProtocolMapKey({
      protocol: `p${i}`,
      networkId: 'evm--1',
    });
    map[key] = { protocolName: `p${i}`, protocolLogo: '' } as IProtocolSummary;
  }
  return map;
}

describe('buildDeFiOverviewRenderCells with cols', () => {
  it('returns all protocols and no More cell when length <= 3*cols (cols=4)', () => {
    const cells = buildDeFiOverviewRenderCells({
      rankedProtocols: makeRanked(12),
      protocolMap: makeMap(12),
      isExpanded: false,
      cols: 4,
    });
    expect(cells).toHaveLength(12);
    expect(cells.every((c) => c.kind === 'protocol')).toBe(true);
  });

  it('emits 10 protocols + 1 More(span=2) when length > 12 collapsed (cols=4)', () => {
    const cells = buildDeFiOverviewRenderCells({
      rankedProtocols: makeRanked(20),
      protocolMap: makeMap(20),
      isExpanded: false,
      cols: 4,
    });
    expect(cells).toHaveLength(11);
    expect(cells.slice(0, 10).every((c) => c.kind === 'protocol')).toBe(true);
    expect(cells[10]).toMatchObject({ kind: 'more', span: 2 });
  });

  it('emits 13 protocols + 1 More(span=2) when length > 15 collapsed (cols=5)', () => {
    const cells = buildDeFiOverviewRenderCells({
      rankedProtocols: makeRanked(20),
      protocolMap: makeMap(20),
      isExpanded: false,
      cols: 5,
    });
    expect(cells).toHaveLength(14);
    expect(cells[13]).toMatchObject({ kind: 'more', span: 2 });
  });

  it('emits 16 protocols + 1 More(span=2) when length > 18 collapsed (cols=6)', () => {
    const cells = buildDeFiOverviewRenderCells({
      rankedProtocols: makeRanked(25),
      protocolMap: makeMap(25),
      isExpanded: false,
      cols: 6,
    });
    expect(cells).toHaveLength(17);
    expect(cells[16]).toMatchObject({ kind: 'more', span: 2 });
  });

  it('emits all + Less(span=1) when expanded and length > cellsLimit', () => {
    const cells = buildDeFiOverviewRenderCells({
      rankedProtocols: makeRanked(25),
      protocolMap: makeMap(25),
      isExpanded: true,
      cols: 6,
    });
    expect(cells).toHaveLength(26);
    expect(cells[25]).toMatchObject({ kind: 'less', span: 1 });
  });

  it('does not emit Less when length <= cellsLimit even if isExpanded=true', () => {
    const cells = buildDeFiOverviewRenderCells({
      rankedProtocols: makeRanked(8),
      protocolMap: makeMap(8),
      isExpanded: true,
      cols: 4,
    });
    expect(cells).toHaveLength(8);
    expect(cells.every((c) => c.kind === 'protocol')).toBe(true);
  });

  it('returns empty array on zero-length input', () => {
    expect(
      buildDeFiOverviewRenderCells({
        rankedProtocols: [],
        protocolMap: {},
        isExpanded: false,
        cols: 6,
      }),
    ).toEqual([]);
  });

  it('does not bind stacked-bar slice data to protocol cells', () => {
    const cells = buildDeFiOverviewRenderCells({
      rankedProtocols: makeRanked(3),
      protocolMap: makeMap(3),
      isExpanded: false,
      cols: 4,
    });
    for (const cell of cells) {
      expect(cell).toMatchObject({ kind: 'protocol' });
      expect(cell).not.toHaveProperty('slice');
    }
  });

  it('returns the mounted protocol limit required by the collapsed overview', () => {
    expect(
      getOverviewCollapsedProtocolLimit({ cols: 4, protocolCount: 12 }),
    ).toBe(12);
    expect(
      getOverviewCollapsedProtocolLimit({ cols: 4, protocolCount: 13 }),
    ).toBe(10);
    expect(
      getOverviewCollapsedProtocolLimit({ cols: 5, protocolCount: 15 }),
    ).toBe(15);
    expect(
      getOverviewCollapsedProtocolLimit({ cols: 5, protocolCount: 16 }),
    ).toBe(13);
    expect(
      getOverviewCollapsedProtocolLimit({ cols: 6, protocolCount: 18 }),
    ).toBe(18);
    expect(
      getOverviewCollapsedProtocolLimit({ cols: 6, protocolCount: 19 }),
    ).toBe(16);
  });
});
