let prevLogMessage: string | undefined;
let dedupRepeatCount = 0;

export function consumeDesktopDedupMessage(joinedMessage: string): {
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
    dedupRepeatCount > 0 ? [`[${dedupRepeatCount} repeat]\n`] : [];
  prevLogMessage = joinedMessage;
  dedupRepeatCount = 0;

  return {
    shouldSkip: false,
    repeatPrefix,
  };
}

export function flushDesktopDedupState(
  writeMessage: (message: string) => void,
): void {
  if (dedupRepeatCount > 0) {
    const count = dedupRepeatCount;
    dedupRepeatCount = 0;
    prevLogMessage = undefined;
    writeMessage(`[${count} repeat]`);
    return;
  }

  prevLogMessage = undefined;
}

export function resetDesktopDedupState(): void {
  prevLogMessage = undefined;
  dedupRepeatCount = 0;
}
