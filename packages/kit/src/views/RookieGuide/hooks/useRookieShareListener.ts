import { useEffect } from 'react';

import type { useInPageDialog } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IRookieShareData } from '@onekeyhq/shared/types/rookieGuide';

export function useRookieShareListener(
  dialog?: ReturnType<typeof useInPageDialog>,
) {
  useEffect(() => {
    const handler = (payload: { data: IRookieShareData }) => {
      void import('../components/RookieShare').then(
        ({ showRookieShareDialog }) => {
          showRookieShareDialog(payload.data, dialog);
        },
      );
    };

    appEventBus.on(EAppEventBusNames.ShowRookieShare, handler);

    return () => {
      appEventBus.off(EAppEventBusNames.ShowRookieShare, handler);
    };
  }, [dialog]);
}
