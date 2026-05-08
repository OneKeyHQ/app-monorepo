import { resolveOverviewCols } from './overviewColsResolver';

describe('resolveOverviewCols', () => {
  it('returns 6 when gtXl is true', () => {
    expect(resolveOverviewCols({ gtXl: true, gtLg: true })).toBe(6);
  });

  it('returns 5 when gtLg is true and gtXl is false', () => {
    expect(resolveOverviewCols({ gtXl: false, gtLg: true })).toBe(5);
  });

  it('returns 4 when no flag is true', () => {
    expect(resolveOverviewCols({ gtXl: false, gtLg: false })).toBe(4);
  });

  it('treats missing flags as false', () => {
    expect(resolveOverviewCols({})).toBe(4);
  });
});
