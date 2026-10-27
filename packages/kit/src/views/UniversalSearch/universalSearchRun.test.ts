import { isSearchResponseCurrent } from './universalSearchRun';

describe('isSearchResponseCurrent', () => {
  it('rejects an earlier run of the same query that answers late', () => {
    // A (run 1) -> B (run 2) -> A (run 3): run 1 answers after run 3.
    expect(
      isSearchResponseCurrent({
        run: 1,
        input: 'A',
        currentRun: 3,
        currentInput: 'A',
      }),
    ).toBe(false);
    expect(
      isSearchResponseCurrent({
        run: 3,
        input: 'A',
        currentRun: 3,
        currentInput: 'A',
      }),
    ).toBe(true);
  });

  it('rejects a response once the input changed', () => {
    expect(
      isSearchResponseCurrent({
        run: 2,
        input: 'B',
        currentRun: 2,
        currentInput: 'BC',
      }),
    ).toBe(false);
  });
});
