import { resolveMarketJumpIntentAfterHandoff } from './swapMarketJumpIntent';

type IJumpIntent = {
  token?: { id: string };
};

describe('resolveMarketJumpIntentAfterHandoff', () => {
  it('clears the intent this handoff captured when nothing replaced it', () => {
    const capturedIntent: IJumpIntent = { token: { id: 'aapl' } };

    expect(
      resolveMarketJumpIntentAfterHandoff(capturedIntent, capturedIntent),
    ).toEqual({
      clearCapturedIntent: true,
      nextIntent: undefined,
    });
  });

  it('keeps a newer intent that arrived while the handoff was in flight', () => {
    const capturedIntent: IJumpIntent = { token: { id: 'aapl' } };
    const newerIntent: IJumpIntent = { token: { id: 'nvda' } };

    expect(
      resolveMarketJumpIntentAfterHandoff(capturedIntent, newerIntent),
    ).toEqual({
      clearCapturedIntent: false,
      nextIntent: newerIntent,
    });
  });

  it('does not treat an equal copy as the same in-flight intent', () => {
    const capturedIntent: IJumpIntent = { token: { id: 'aapl' } };
    const copiedIntent: IJumpIntent = { token: { id: 'aapl' } };

    expect(
      resolveMarketJumpIntentAfterHandoff(capturedIntent, copiedIntent),
    ).toEqual({
      clearCapturedIntent: false,
      nextIntent: copiedIntent,
    });
  });

  it('clears when the pending intent disappeared', () => {
    const capturedIntent: IJumpIntent = { token: { id: 'aapl' } };

    expect(
      resolveMarketJumpIntentAfterHandoff(capturedIntent, undefined),
    ).toEqual({
      clearCapturedIntent: true,
      nextIntent: undefined,
    });
  });

  it('leaves an already-cleared replacement untouched', () => {
    const capturedIntent: IJumpIntent = { token: { id: 'aapl' } };
    const clearedIntent: IJumpIntent = { token: undefined };

    expect(
      resolveMarketJumpIntentAfterHandoff(capturedIntent, clearedIntent),
    ).toEqual({
      clearCapturedIntent: false,
      nextIntent: undefined,
    });
  });
});
