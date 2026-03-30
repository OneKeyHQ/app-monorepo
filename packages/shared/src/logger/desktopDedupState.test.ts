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
    expect(consumeDesktopDedupMessage('[info] hello', 'info')).toEqual({
      shouldSkip: false,
      repeatPrefix: [],
    });
    expect(consumeDesktopDedupMessage('[info] hello', 'info')).toEqual({
      shouldSkip: true,
      repeatPrefix: [],
    });
    expect(consumeDesktopDedupMessage('[info] hello', 'info')).toEqual({
      shouldSkip: true,
      repeatPrefix: [],
    });

    const flushed: { message: string; level: string | undefined }[] = [];
    flushDesktopDedupState((message, level) => {
      flushed.push({ message, level });
    });

    expect(flushed).toEqual([{ message: '[2 repeat]', level: 'info' }]);
    expect(consumeDesktopDedupMessage('[info] hello', 'info')).toEqual({
      shouldSkip: false,
      repeatPrefix: [],
    });
  });

  it('includes the original level in repeat prefix when message changes', () => {
    consumeDesktopDedupMessage('[error] something failed', 'error');
    consumeDesktopDedupMessage('[error] something failed', 'error');
    consumeDesktopDedupMessage('[error] something failed', 'error');

    const result = consumeDesktopDedupMessage('[info] new message', 'info');
    expect(result).toEqual({
      shouldSkip: false,
      repeatPrefix: ['[error] [2 repeat]\n'],
    });
  });
});
