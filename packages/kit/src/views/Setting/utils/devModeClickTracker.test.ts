import { advanceDevModeClickSequence } from './devModeClickTracker';

describe('advanceDevModeClickSequence', () => {
  it('copies only on the first click in a sequence', () => {
    const firstClick = advanceDevModeClickSequence({
      state: {
        clickCount: 0,
        startTime: undefined,
      },
      now: 1000,
    });
    const secondClick = advanceDevModeClickSequence({
      state: firstClick.state,
      now: 1100,
    });

    expect(firstClick.shouldCopyVersion).toBe(true);
    expect(firstClick.state.clickCount).toBe(1);
    expect(secondClick.shouldCopyVersion).toBe(false);
    expect(secondClick.state.clickCount).toBe(2);
  });

  it('starts a new copy sequence after the timeout', () => {
    const nextClick = advanceDevModeClickSequence({
      state: {
        clickCount: 4,
        startTime: 1000,
      },
      now: 6001,
    });

    expect(nextClick.shouldCopyVersion).toBe(true);
    expect(nextClick.shouldOpenDevMode).toBe(false);
    expect(nextClick.state).toEqual({
      clickCount: 1,
      startTime: 6001,
    });
  });

  it('opens developer mode on the tenth click within the window', () => {
    let state = {
      clickCount: 0,
      startTime: undefined as number | undefined,
    };

    for (let clickIndex = 0; clickIndex < 9; clickIndex += 1) {
      const result = advanceDevModeClickSequence({
        state,
        now: 1000 + clickIndex * 100,
      });
      state = result.state;
      expect(result.shouldOpenDevMode).toBe(false);
    }

    const tenthClick = advanceDevModeClickSequence({
      state,
      now: 1900,
    });

    expect(tenthClick.shouldCopyVersion).toBe(false);
    expect(tenthClick.shouldOpenDevMode).toBe(true);
    expect(tenthClick.state.clickCount).toBe(10);
  });
});
