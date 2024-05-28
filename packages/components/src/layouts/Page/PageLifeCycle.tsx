import type { MutableRefObject } from 'react';
import { useCallback } from 'react';

import { usePageLifeCycle } from './hooks';

import type { IPageLifeCycle } from './type';

export function PageLifeCycle({
  onMounted,
  onUnmounted,
  onCancel,
  onConfirm,
  onClose,
  confirmedRef,
}: IPageLifeCycle & { confirmedRef: MutableRefObject<boolean> }) {
  const handleUnmounted = useCallback(() => {
    onUnmounted?.();
    if (confirmedRef.current) {
      onConfirm?.();
    } else {
      onCancel?.();
    }
    onClose?.(confirmedRef.current || false);
  }, [confirmedRef, onCancel, onClose, onConfirm, onUnmounted]);
  usePageLifeCycle({ onMounted, onUnmounted: handleUnmounted });
  return null;
}
