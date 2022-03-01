import React, { useCallback } from 'react';

import { Toast, useToast as useBaseToast } from '@onekeyhq/components';
import { ToastProps } from '@onekeyhq/components/src/Toast';

type Options = {
  placement?:
    | 'top'
    | 'top-right'
    | 'top-left'
    | 'bottom'
    | 'bottom-left'
    | 'bottom-right';
};

export function useToast() {
  const toast = useBaseToast();
  const info = useCallback(
    (text: string, options?: Options) =>
      toast.show({
        render: () => <Toast title={text} />,
        placement: options?.placement,
      }) as string,
    [toast],
  );
  const show = useCallback(
    (props: ToastProps) =>
      toast.show({
        render: () => <Toast {...props} />,
      }) as string,
    [toast],
  );
  return { ...toast, info, show };
}
