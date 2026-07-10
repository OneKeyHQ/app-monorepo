import { Suspense, lazy, useEffect, useRef, useSyncExternalStore } from 'react';

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

type IWalletConnectOpenModalPayload =
  IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal];

let pendingPayload: IWalletConnectOpenModalPayload | null = null;
let wasModalOpened = false;
const pendingPayloadListeners = new Set<() => void>();

function getPendingPayload() {
  return pendingPayload;
}

function subscribePendingPayload(listener: () => void) {
  pendingPayloadListeners.add(listener);
  return () => {
    pendingPayloadListeners.delete(listener);
  };
}

function updatePendingPayload(payload: IWalletConnectOpenModalPayload) {
  if (pendingPayload?.uri === payload.uri) return;
  pendingPayload = payload;
  wasModalOpened = false;
  pendingPayloadListeners.forEach((listener) => listener());
}

function clearPendingPayload() {
  if (!pendingPayload) return;
  pendingPayload = null;
  wasModalOpened = false;
  pendingPayloadListeners.forEach((listener) => listener());
}

function handleModalState({
  open,
}: IAppEventBusPayload[EAppEventBusNames.WalletConnectModalState]) {
  if (open) {
    wasModalOpened = true;
  } else if (wasModalOpened) {
    clearPendingPayload();
  }
}

function ReplayWalletConnectEvent({
  payload,
}: {
  payload: IWalletConnectOpenModalPayload;
}) {
  const replayed = useRef(false);
  useEffect(() => {
    if (replayed.current) return;
    replayed.current = true;
    // Re-emit after WalletConnectModalContainer registers its listeners
    const timer = setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, payload);
    }, 0);
    return () => clearTimeout(timer);
  }, [payload]);
  return null;
}

function WalletConnectModalGate() {
  const payload = useSyncExternalStore(
    subscribePendingPayload,
    getPendingPayload,
    getPendingPayload,
  );

  if (!payload) return null;

  return (
    <Suspense fallback={null}>
      <WalletConnectModalContainerLazy />
      <ReplayWalletConnectEvent payload={payload} />
    </Suspense>
  );
}

export function GlobalWalletConnectModalContainer() {
  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.WalletConnectOpenModal,
      updatePendingPayload,
    );
    appEventBus.on(
      EAppEventBusNames.WalletConnectCloseModal,
      clearPendingPayload,
    );
    appEventBus.on(EAppEventBusNames.WalletConnectModalState, handleModalState);
    return () => {
      appEventBus.off(
        EAppEventBusNames.WalletConnectOpenModal,
        updatePendingPayload,
      );
      appEventBus.off(
        EAppEventBusNames.WalletConnectCloseModal,
        clearPendingPayload,
      );
      appEventBus.off(
        EAppEventBusNames.WalletConnectModalState,
        handleModalState,
      );
    };
  }, []);

  // Page.Every does not notify the active page when its slot is populated later,
  // so Container renders this registration before its routers. The payload store
  // remains stable when focused pages remount the visual gate during navigation.
  return platformEnv.isNativeIOS ? (
    <Page.Every>
      <WalletConnectModalGate />
    </Page.Every>
  ) : (
    <WalletConnectModalGate />
  );
}
