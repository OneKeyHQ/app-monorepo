export function isDefaultStockTokenRequestPending({
  isLoading,
  requestReady,
  requestScope,
  resultScope,
  shouldLoad,
}: {
  isLoading: boolean;
  requestReady: boolean;
  requestScope: string;
  resultScope: string;
  shouldLoad: boolean;
}) {
  return Boolean(
    shouldLoad &&
    (!requestReady ||
      isLoading ||
      !requestScope ||
      resultScope !== requestScope),
  );
}
