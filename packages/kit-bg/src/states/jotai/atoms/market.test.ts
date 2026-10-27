import {
  type IMarketDetailChartDisplayModePersistAtom,
  type IMarketDetailPositionTabPersistAtom,
  type IMarketSelectedTabAtom,
  marketDetailChartDisplayModePersistAtom,
  marketDetailPositionTabPersistAtom,
  marketSelectedTabAtom,
} from './market';

import type { IJotaiAtomPro } from '../types';

describe('marketDetailChartDisplayModePersistAtom', () => {
  const atom =
    marketDetailChartDisplayModePersistAtom.atom() as unknown as IJotaiAtomPro<IMarketDetailChartDisplayModePersistAtom>;

  it('defaults to the simple chart', () => {
    expect(atom.initialValue).toEqual({ mode: 'simple' });
  });

  it('persists the selected chart display mode', () => {
    expect(atom.persist).toBe(true);
  });

  it('does not share state with the market tab selection', () => {
    const marketTabAtom =
      marketSelectedTabAtom.atom() as unknown as IJotaiAtomPro<IMarketSelectedTabAtom>;

    expect(atom.name).not.toBe(marketTabAtom.name);
    expect(marketTabAtom.initialValue).toEqual({ tab: 'trending' });
  });
});

describe('marketDetailPositionTabPersistAtom', () => {
  const atom =
    marketDetailPositionTabPersistAtom.atom() as unknown as IJotaiAtomPro<IMarketDetailPositionTabPersistAtom>;

  it('starts on each page default tab and persists the choice', () => {
    expect(atom.initialValue).toEqual({ preferPosition: false });
    expect(atom.persist).toBe(true);
  });
});
