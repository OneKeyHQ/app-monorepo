import { TIF_OPTIONS, getTifLabel, isTifValue } from './timeInForce';

describe('timeInForce utils', () => {
  it('exposes Hyperliquid limit TIF options in UI order', () => {
    expect(TIF_OPTIONS).toEqual([
      { label: 'GTC', value: 'Gtc' },
      { label: 'IOC', value: 'Ioc' },
      { label: 'ALO', value: 'Alo' },
    ]);
  });

  it('accepts only supported user-selectable TIF values', () => {
    expect(isTifValue('Gtc')).toBe(true);
    expect(isTifValue('Ioc')).toBe(true);
    expect(isTifValue('Alo')).toBe(true);
    expect(isTifValue('FrontendMarket')).toBe(false);
    expect(isTifValue(undefined)).toBe(false);
  });

  it('formats known TIF values and ignores unknown open-order values', () => {
    expect(getTifLabel('Gtc')).toBe('GTC');
    expect(getTifLabel('Ioc')).toBe('IOC');
    expect(getTifLabel('Alo')).toBe('ALO');
    expect(getTifLabel(null)).toBeUndefined();
    expect(getTifLabel(undefined)).toBeUndefined();
  });
});
