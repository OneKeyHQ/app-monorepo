/**
 * Whether a background search response still belongs to the search on
 * screen: the same run, not only the same query, so an earlier run of that
 * query answering late cannot overwrite the latest run's results or its
 * pending analytics.
 */
export function isSearchResponseCurrent({
  run,
  input,
  currentRun,
  currentInput,
}: {
  run: number;
  input: string;
  currentRun: number;
  currentInput: string;
}): boolean {
  return run === currentRun && input === currentInput;
}
