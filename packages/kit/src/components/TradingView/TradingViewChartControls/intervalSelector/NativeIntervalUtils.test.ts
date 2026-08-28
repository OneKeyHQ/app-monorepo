import {
  COMPACT_MOBILE_MAX_PREFERRED_INTERVAL_COUNT,
  getDefaultPreferredIntervalValues,
  mergeVisiblePreferredIntervalValues,
} from './NativeIntervalUtils';

const options = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: '1D' },
];

describe('NativeIntervalUtils', () => {
  it('keeps four defaults normally and expands compact charts to six', () => {
    expect(getDefaultPreferredIntervalValues(options)).toEqual([
      '1',
      '15',
      '60',
      '240',
    ]);
    expect(
      getDefaultPreferredIntervalValues(
        options,
        COMPACT_MOBILE_MAX_PREFERRED_INTERVAL_COUNT,
      ),
    ).toEqual(['1', '5', '15', '30', '60', '240']);
  });

  it('preserves preferences hidden by a smaller toolbar', () => {
    expect(
      mergeVisiblePreferredIntervalValues({
        currentValues: ['1', '5', '15', '30', '60', '240'],
        nextVisibleValues: ['1', '5', '15', '30'],
        maxVisibleIntervalCount: 4,
        options,
      }),
    ).toEqual(['1', '5', '15', '30', '60', '240']);
  });

  it('lets an unlimited editor replace the complete preference list', () => {
    expect(
      mergeVisiblePreferredIntervalValues({
        currentValues: ['1', '5', '15', '30', '60', '240'],
        nextVisibleValues: ['1', '5', '15', '30'],
        maxVisibleIntervalCount: null,
        options,
      }),
    ).toEqual(['1', '5', '15', '30']);
  });
});
