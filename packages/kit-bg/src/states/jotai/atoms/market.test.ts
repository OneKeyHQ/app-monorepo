import {
  type IMarketDetailChartDisplayModePersistAtom,
  type IMarketSelectedTabAtom,
  marketDetailChartDisplayModePersistAtom,
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
