import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LazyDisplayView } from './LazyDisplayView';

// TODO not working, check preload-html-head.js optimizeResize()
export function WindowResizeOptimize({ children }: { children: JSX.Element }) {
  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => {
    let timer: any = null;
    const handler = () => {
      clearTimeout(timer);
      setIsResizing(true);
      timer = setTimeout(() => setIsResizing(false), 600);
    };
    if (platformEnv.isRuntimeBrowser) {
      // not working, as NativeBase resize handler trigger first
      window.addEventListener('resize', handler);
    }
    return () => {
      if (platformEnv.isRuntimeBrowser) {
        window.removeEventListener('resize', handler);
      }
    };
  }, []);
  if (isResizing) {
    return null;
  }
  return <LazyDisplayView delay={0}>{children}</LazyDisplayView>;
}
