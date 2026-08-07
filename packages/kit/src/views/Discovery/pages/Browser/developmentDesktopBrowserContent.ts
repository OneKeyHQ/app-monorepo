import type { IDevelopmentDesktopBrowserContentProps } from './developmentDesktopBrowserContentTypes';

export function useDevelopmentDesktopBrowserContent({
  id,
  tabUrl,
}: {
  id: string;
  props: IDevelopmentDesktopBrowserContentProps;
  tabUrl?: string;
}) {
  return {
    effectiveUrl: tabUrl,
    isWebViewInstanceCurrent: () => true,
    webContentProps: {},
    webViewInstanceKey: id,
  };
}
