const LOCAL_DB_DOWNGRADE_ERROR_PATTERNS = [
  /^The requested version \((\d+)\) is less than the existing version \((\d+)\)\.$/,
  /^Provided schema version (\d+) is less than last set version (\d+)\.$/,
];

export function isLocalDbDowngradeErrorMessage(errorMessage: string): boolean {
  for (const pattern of LOCAL_DB_DOWNGRADE_ERROR_PATTERNS) {
    const match = pattern.exec(errorMessage);
    if (match) {
      return BigInt(match[1]) < BigInt(match[2]);
    }
  }
  return false;
}

export function formatLocalDbOpenErrorMessage(
  errorMessage: string,
  downgradeGuidanceMessage: string,
): string {
  if (isLocalDbDowngradeErrorMessage(errorMessage)) {
    return `${errorMessage}\n${downgradeGuidanceMessage}`;
  }
  return errorMessage;
}
