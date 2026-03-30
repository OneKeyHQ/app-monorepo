import {
  consumeDesktopDedupMessage,
  flushDesktopDedupState,
  resetDesktopDedupState,
} from './desktopDedupState';

describe('desktopDedupState', () => {
  beforeEach(() => {
    resetDesktopDedupState();
  });

  it('collapses repeated messages and flushes the pending repeat summary', () => {
    expect(consumeDesktopDedupMessage('[info] hello')).toEqual({
      shouldSkip: false,
      repeatPrefix: [],
    });
    expect(consumeDesktopDedupMessage('[info] hello')).toEqual({
      shouldSkip: true,
      repeatPrefix: [],
    });
    expect(consumeDesktopDedupMessage('[info] hello')).toEqual({
      shouldSkip: true,
      repeatPrefix: [],
    });

    const flushed: string[] = [];
    flushDesktopDedupState((message) => {
      flushed.push(message);
    });

    expect(flushed).toEqual(['[2 repeat]']);
    expect(consumeDesktopDedupMessage('[info] hello')).toEqual({
      shouldSkip: false,
      repeatPrefix: [],
    });
  });
});
