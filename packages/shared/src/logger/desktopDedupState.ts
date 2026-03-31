let prevLogMessage: string | undefined;
let prevLogLevel: string | undefined;
let dedupRepeatCount = 0;

export function consumeDesktopDedupMessage(
  joinedMessage: string,
  level?: string,
): {
  shouldSkip: boolean;
  repeatPrefix: string[];
} {
  if (joinedMessage === prevLogMessage) {
    dedupRepeatCount += 1;
    return {
      shouldSkip: true,
      repeatPrefix: [],
    };
  }

  const repeatPrefix =
    dedupRepeatCount > 0
      ? [`[${prevLogLevel ?? 'info'}] [${dedupRepeatCount} repeat]\n`]
      : [];
  prevLogMessage = joinedMessage;
  prevLogLevel = level;
  dedupRepeatCount = 0;

  return {
    shouldSkip: false,
    repeatPrefix,
  };
}

export function flushDesktopDedupState(
  writeMessage: (message: string, level?: string) => void,
): void {
  if (dedupRepeatCount > 0) {
    const count = dedupRepeatCount;
    const level = prevLogLevel;
    dedupRepeatCount = 0;
    prevLogMessage = undefined;
    prevLogLevel = undefined;
    writeMessage(`[${count} repeat]`, level);
    return;
  }

  prevLogMessage = undefined;
  prevLogLevel = undefined;
}

export function resetDesktopDedupState(): void {
  prevLogMessage = undefined;
  prevLogLevel = undefined;
  dedupRepeatCount = 0;
}
