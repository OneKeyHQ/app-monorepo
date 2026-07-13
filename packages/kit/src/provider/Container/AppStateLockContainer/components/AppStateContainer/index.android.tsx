import { type PropsWithChildren, useEffect } from 'react';

import { Portal } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

export function AppStateContainer({ children }: PropsWithChildren) {
  // The WalletConnect Modal is above the Android lock screen, it needs to be closed when the lock screen appears
  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined);
  }, []);
  return (
    <>
      {children}
      <Portal.Container
        name={Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY}
      />
    </>
  );
}
