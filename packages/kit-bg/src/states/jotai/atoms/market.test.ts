import { type IMarketSelectedTabAtom, marketSelectedTabAtom } from './market';

import type { IJotaiAtomPro } from '../types';

describe('marketSelectedTabAtom', () => {
  const atom =
    marketSelectedTabAtom.atom() as unknown as IJotaiAtomPro<IMarketSelectedTabAtom>;

  it('defaults to the trending tab and simple chart', () => {
    expect(atom.initialValue).toEqual({
      tab: 'trending',
      chartDisplayMode: 'simple',
    });
  });

  it('persists market UI preferences', () => {
    expect(atom.persist).toBe(true);
  });
});
