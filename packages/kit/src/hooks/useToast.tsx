import React, { useCallback } from 'react';

import { Toast, useToast as useBaseToast } from '@onekeyhq/components';

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
  return { info };
}
