import { useCallback, useEffect, useState } from 'react';

export default function useIsIpcReady(): boolean {
  const [isIpcReady, setIsIpcReady] = useState(false);
  const checkReady = useCallback(() => {
    const isBridgeInjected = Boolean(
      window?.ONEKEY_DESKTOP_GLOBALS?.preloadJsUrl,
    );
    if (isBridgeInjected) {
      setIsIpcReady(true);
    } else {
      setTimeout(checkReady, 100);
    }
  }, []);

  useEffect(() => {
    checkReady();
  }, [checkReady]);

  useEffect(() => {
    if (isIpcReady) {
      return;
    }
    const timer = setTimeout(() => {
      if (!isIpcReady) {
        console.error(
          'electron ipc not ready yet, can not render <webview>, do you forget set parameter [preload] at new BrowserWindow() in app.ts ?',
        );
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isIpcReady]);

  return isIpcReady;
}
