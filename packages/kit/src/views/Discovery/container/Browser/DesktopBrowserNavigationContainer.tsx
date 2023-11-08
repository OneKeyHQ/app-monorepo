import { useCallback, useEffect, useMemo, useState } from 'react';

import { Freeze } from 'react-freeze';

import DesktopBrowserInfoBar from '../../components/DesktopBrowser/DesktopBrowserInfoBar';
import { useWebTabData } from '../../hooks/useWebTabs';
import { getWebviewWrapperRef, webviewRefs } from '../../utils/explorerUtils';

import type { IElectronWebView } from '../../components/WebView/types';

function DesktopBrowserNavigationBar({
  id,
  activeTabId,
}: {
  id: string;
  activeTabId: string | null;
}) {
  const { tab } = useWebTabData(id);
  const isActive = useMemo(() => activeTabId === id, [activeTabId, id]);
  const [innerRef, setInnerRef] = useState<IElectronWebView>(
    webviewRefs[id]?.innerRef as IElectronWebView,
  );

  useEffect(() => {
    if (tab?.refReady) {
      setInnerRef(webviewRefs[id]?.innerRef as IElectronWebView);
    }
  }, [id, tab?.refReady]);

  const goBack = useCallback(() => {
    let canGoBack = tab?.refReady && tab?.canGoBack;
    if (innerRef) {
      canGoBack = innerRef.canGoBack();
    }
    innerRef?.stop();
    if (canGoBack) {
      try {
        innerRef?.goBack();
      } catch {
        /* empty */
      }
    }
  }, [innerRef, tab?.canGoBack, tab?.refReady]);
  const goForward = useCallback(() => {
    try {
      innerRef?.goForward();
    } catch {
      /* empty */
    }
  }, [innerRef]);
  const stopLoading = useCallback(() => {
    try {
      innerRef?.stop();
    } catch {
      /* empty */
    }
  }, [innerRef]);
  const reload = useCallback(() => {
    try {
      const wrapperRef = getWebviewWrapperRef(id);
      // cross-platform reload()
      wrapperRef?.reload();
    } catch {
      /* empty */
    }
  }, [id]);

  return (
    <Freeze key={`${id}-navigationBar`} freeze={!isActive}>
      <DesktopBrowserInfoBar
        {...tab}
        goBack={goBack}
        goForward={goForward}
        stopLoading={stopLoading}
        reload={reload}
      />
    </Freeze>
  );
}

export default DesktopBrowserNavigationBar;
