export function buildHomeSourceExecutionKey({
  sessionId,
  sourceKey,
}: {
  sessionId: string;
  sourceKey: string;
}): string {
  return `${sessionId.length}:${sessionId}:${sourceKey}`;
}

export function normalizeHomePortfolioLpCacheControl(value: unknown): boolean {
  return value === true;
}
