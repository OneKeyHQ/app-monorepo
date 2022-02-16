import React, { useCallback } from 'react';

import { Toast, useToast as useBaseToast } from '@onekeyhq/components';
import { ToastProps } from '@onekeyhq/components/src/Toast';

export function useToast() {
  const toast = useBaseToast();
  const info = useCallback(
    (text: string) => {
      toast.show({
        render: () => <Toast title={text} />,
      });
    },
    [toast],
  );
  const show = useCallback(
    (props: ToastProps) => {
      toast.show({
        render: () => <Toast {...props} />,
      });
    },
    [toast],
  );
  return { ...toast, info, show };
}
