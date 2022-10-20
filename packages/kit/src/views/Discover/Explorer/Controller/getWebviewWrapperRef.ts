import { webviewRefs } from '../explorerUtils';

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$webviewRefs = webviewRefs;
}
export function getWebviewWrapperRef({
  tabId,
}: {
  tabId: string | null | undefined;
}) {
  // DO NOT useMemo() here, as webviewRefs may be updated
  const ref = tabId ? webviewRefs[tabId] : null;
  return ref ?? null;
}
