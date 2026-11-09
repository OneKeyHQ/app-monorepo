export function resolveMarketJumpIntentAfterHandoff<
  T extends { token?: unknown },
>(
  capturedIntent: T,
  currentIntent: T | undefined,
): {
  clearCapturedIntent: boolean;
  nextIntent: T | undefined;
} {
  if (!currentIntent || currentIntent === capturedIntent) {
    return { clearCapturedIntent: true, nextIntent: undefined };
  }
  if (currentIntent.token) {
    return { clearCapturedIntent: false, nextIntent: currentIntent };
  }
  return { clearCapturedIntent: false, nextIntent: undefined };
}
