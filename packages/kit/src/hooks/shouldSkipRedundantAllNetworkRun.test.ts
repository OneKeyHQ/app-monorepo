/**
 * L5 — gate predicate for skipping redundant all-network run re-fires.
 * Safe by construction: only skips a same-owner repeat once data is loaded and
 * no must-run flag is set. (Every explicit refresh passes a must-run flag;
 * owner / enabled-network changes reset `allNetworkDataInit`.)
 */
import { shouldSkipRedundantAllNetworkRun } from './shouldSkipRedundantAllNetworkRun';

const base = {
  isMustRun: false,
  allNetworkDataInit: true,
  currentSignature: 'acc|net|wallet',
  lastSignature: 'acc|net|wallet',
};

describe('shouldSkipRedundantAllNetworkRun', () => {
  it('skips a same-owner re-fire when data is loaded and no must-run flag', () => {
    expect(shouldSkipRedundantAllNetworkRun(base)).toBe(true);
  });

  it('never skips a must-run refresh', () => {
    expect(shouldSkipRedundantAllNetworkRun({ ...base, isMustRun: true })).toBe(
      false,
    );
  });

  it('never skips before data is loaded (init false)', () => {
    expect(
      shouldSkipRedundantAllNetworkRun({ ...base, allNetworkDataInit: false }),
    ).toBe(false);
  });

  it('never skips when the owner signature changed', () => {
    expect(
      shouldSkipRedundantAllNetworkRun({
        ...base,
        currentSignature: 'other|net|wallet',
      }),
    ).toBe(false);
  });

  it('never skips on the first run (no last signature)', () => {
    expect(
      shouldSkipRedundantAllNetworkRun({ ...base, lastSignature: null }),
    ).toBe(false);
  });
});
