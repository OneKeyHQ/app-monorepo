import type { MutableRefObject } from 'react';
import { useCallback } from 'react';

import { usePageLifeCycle } from './hooks';

import type { IPageLifeCycle } from './type';

export function PageLifeCycle({
  onMounted,
  onUnmounted,
  onClose,
  onRedirected,
  shouldRedirect,
  closeExtraRef,
}: IPageLifeCycle & {
  closeExtraRef: MutableRefObject<{ flag?: string }>;
}) {
  const handleUnmounted = useCallback(() => {
    onUnmounted?.();
    onClose?.(closeExtraRef.current);
  }, [closeExtraRef, onClose, onUnmounted]);
  usePageLifeCycle({
    onMounted,
    onUnmounted: handleUnmounted,
    onRedirected,
    shouldRedirect,
  });
  return null;
}
