import { Suspense, lazy, useEffect, useRef, useState } from 'react';

import { Page } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const WalletConnectModalContainerLazy = lazy(() =>
  import('../../../components/WalletConnect/WalletConnectModalContainer').then(
    (m) => ({
      default: m.WalletConnectModalContainer,
    }),
  ),
);

function ReplayWalletConnectEvent({
  payload,
}: {
  payload: IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal];
}) {
  const replayed = useRef(false);
  useEffect(() => {
    if (replayed.current) return;
    replayed.current = true;
    // Re-emit after WalletConnectModalContainer registers its listeners
    setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, payload);
    }, 0);
  }, [payload]);
  return null;
}

export function GlobalWalletConnectModalContainer() {
  const [pendingPayload, setPendingPayload] = useState<
    IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal] | null
  >(null);

  useEffect(() => {
    if (pendingPayload) return;
    const onOpen = (
      p: IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal],
    ) => {
      setPendingPayload(p);
    };
    appEventBus.on(EAppEventBusNames.WalletConnectOpenModal, onOpen);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectOpenModal, onOpen);
    };
  }, [pendingPayload]);

  if (!pendingPayload) return null;

  const container = (
    <Suspense fallback={null}>
      <WalletConnectModalContainerLazy />
      <ReplayWalletConnectEvent payload={pendingPayload} />
    </Suspense>
  );

  return platformEnv.isNativeIOS ? (
    <Page.Every>{container}</Page.Every>
  ) : (
    container
  );
}
