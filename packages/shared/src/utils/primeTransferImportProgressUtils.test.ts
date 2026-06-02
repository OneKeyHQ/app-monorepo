import {
  getPrimeTransferImportProgressPercent,
  getPrimeTransferImportProgressRange,
} from './primeTransferImportProgressUtils';

describe('primeTransferImportProgressUtils', () => {
  test('matches Prime Transfer import UI percentage rules', () => {
    expect(
      getPrimeTransferImportProgressPercent({
        current: 1,
        total: 3,
        isImporting: true,
      }),
    ).toBe(34);
    expect(
      getPrimeTransferImportProgressPercent({
        current: 80,
        total: 100,
        isImporting: true,
      }),
    ).toBe(80);
    expect(
      getPrimeTransferImportProgressPercent({
        current: 0,
        total: 0,
        isImporting: true,
      }),
    ).toBe(0);
    expect(
      getPrimeTransferImportProgressPercent({
        current: 0,
        total: 0,
        isImporting: false,
      }),
    ).toBe(100);
    expect(getPrimeTransferImportProgressPercent(undefined)).toBeUndefined();
    expect(
      getPrimeTransferImportProgressPercent({
        current: 120,
        total: 100,
        isImporting: true,
      }),
    ).toBe(100);
  });

  test('builds the trace progress range from the shared percentage', () => {
    expect(getPrimeTransferImportProgressRange(undefined)).toBeUndefined();
    expect(getPrimeTransferImportProgressRange(79)).toBe('70-80');
    expect(getPrimeTransferImportProgressRange(80)).toBe('80-90');
    expect(getPrimeTransferImportProgressRange(90)).toBe('90-100');
    expect(getPrimeTransferImportProgressRange(91)).toBe('90-100');
    expect(getPrimeTransferImportProgressRange(100)).toBe('100');
  });
});
