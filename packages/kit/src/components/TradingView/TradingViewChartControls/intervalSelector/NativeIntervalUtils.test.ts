import {
  COMPACT_MOBILE_MAX_PREFERRED_INTERVAL_COUNT,
  getDefaultPreferredIntervalValues,
  getVisiblePreferredIntervalValues,
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

  it('keeps a newly selected long interval in the visible prefix', () => {
    const optionsWithThreeMinutes = [
      options[0],
      { label: '3m', value: '3' },
      ...options.slice(1),
    ];
    const preferredValues = mergeVisiblePreferredIntervalValues({
      currentValues: ['1', '3', '5', '15', '60', '240'],
      nextVisibleValues: ['1', '5', '15', '1D'],
      maxVisibleIntervalCount: 4,
      options: optionsWithThreeMinutes,
    });

    expect(preferredValues).toEqual(['1', '5', '15', '1D', '60', '240']);
    expect(
      getVisiblePreferredIntervalValues({
        preferredValues,
        maxVisibleIntervalCount: 4,
        options: optionsWithThreeMinutes,
      }),
    ).toEqual(['1', '5', '15', '1D']);
    expect(
      getVisiblePreferredIntervalValues({
        preferredValues,
        maxVisibleIntervalCount: 6,
        options: optionsWithThreeMinutes,
      }),
    ).toEqual(['1', '5', '15', '60', '240', '1D']);
  });

  it('treats a shorter limited selection as the complete preference list', () => {
    expect(
      mergeVisiblePreferredIntervalValues({
        currentValues: ['1', '5', '15', '30', '60', '240'],
        nextVisibleValues: ['1', '5', '15'],
        maxVisibleIntervalCount: 4,
        options,
      }),
    ).toEqual(['1', '5', '15']);
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
