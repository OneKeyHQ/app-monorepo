import { webviewRefs } from '../explorerUtils';

export function useCurrentWebviewRef({
  currentTabId,
}: {
  currentTabId: string | null | undefined;
}) {
  // DO NOT useMemo() here, as webviewRefs may be updated
  const ref = currentTabId ? webviewRefs[currentTabId] : null;
  return ref ?? null;
}
