import {
  type IMarketDetailChartDisplayModePersistAtom,
  marketDetailChartDisplayModePersistAtom,
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
});
