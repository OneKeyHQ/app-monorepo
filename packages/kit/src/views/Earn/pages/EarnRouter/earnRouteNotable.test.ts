import { isNotableBridgeFee, isNotableBridgeTime } from './earnRouteNotable';

describe('isNotableBridgeTime', () => {
  it('passes over a bridge of under three minutes', () => {
    expect(isNotableBridgeTime(undefined)).toBe(false);
    expect(isNotableBridgeTime({ estimatedTime: '60' })).toBe(false);
    expect(isNotableBridgeTime({ estimatedTime: '179' })).toBe(false);
  });

  it('names a bridge of three minutes or more', () => {
    expect(isNotableBridgeTime({ estimatedTime: '180' })).toBe(true);
    expect(isNotableBridgeTime({ estTime: '12' })).toBe(true);
  });
});

describe('isNotableBridgeFee', () => {
  it('passes over a fee under half a percent of what is paid', () => {
    expect(isNotableBridgeFee(undefined, 100)).toBe(false);
    expect(isNotableBridgeFee(0.01, 25)).toBe(false);
    expect(isNotableBridgeFee(0.49, 100)).toBe(false);
  });

  it('names a fee of half a percent or more', () => {
    expect(isNotableBridgeFee(0.5, 100)).toBe(true);
    expect(isNotableBridgeFee('2.4', '25')).toBe(true);
  });

  it('says nothing without an amount paid', () => {
    expect(isNotableBridgeFee(1, 0)).toBe(false);
    expect(isNotableBridgeFee(1, undefined)).toBe(false);
  });
});
