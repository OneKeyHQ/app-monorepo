import { Suspense, lazy, useEffect, useRef, useSyncExternalStore } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';

import { ESplitViewType, useSplitViewType } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IOverlayAnimation } from '@onekeyfe/react-native-native-overlay';

// AppKit's react-native-modal runs its own slide/fade animation inside the host.
const WALLET_CONNECT_OVERLAY_ANIMATION: IOverlayAnimation = {
  enter: { type: 'none' },
  exit: { type: 'none' },
};

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
  pendingPayloadListeners.forEach((listener) => listener());
}

function clearPendingPayload() {
  if (!pendingPayload) return;
  pendingPayload = null;
  pendingPayloadListeners.forEach((listener) => listener());
}

function handleCloseModal(
  payload: IAppEventBusPayload[EAppEventBusNames.WalletConnectCloseModal],
) {
  if (!pendingPayload) return;
  // An attempt-scoped close only clears its own payload, so a stale close
  // from a superseded attempt cannot tear down the newer pairing. Closes
  // without attemptId are wildcard clears (dialog close, session delete).
  if (
    payload?.attemptId &&
    pendingPayload.attemptId &&
    payload.attemptId !== pendingPayload.attemptId
  ) {
    return;
  }
  clearPendingPayload();
}

function handleModalState({
  open,
  attemptId,
}: IAppEventBusPayload[EAppEventBusNames.WalletConnectModalState]) {
  if (open || !pendingPayload) return;
  // Only the modal session belonging to the current payload may clear it:
  // main and bg schedule independently, so close(A) can be delivered after
  // open(B) and must not drop B back to loading. The native modal's initial
  // open:false emit carries no attemptId and is ignored the same way.
  if (!attemptId || attemptId !== pendingPayload.attemptId) return;
  clearPendingPayload();
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
  const splitViewType = useSplitViewType();
  const payload = useSyncExternalStore(
    subscribePendingPayload,
    getPendingPayload,
    getPendingPayload,
  );

  if (splitViewType === ESplitViewType.MAIN || !payload) return null;

  const content = (
    <Suspense fallback={null}>
      <WalletConnectModalContainerLazy />
      <ReplayWalletConnectEvent payload={payload} />
    </Suspense>
  );

  // On iOS, host AppKit in a fullscreen native OverlayView so it renders above
  // native-stack pageSheet modals without being clipped by sheet headers or
  // remounted/replayed across page focus transitions.
  if (platformEnv.isNativeIOS) {
    return (
      <OverlayView
        visible
        level="modal"
        presentation="fullscreen"
        animation={WALLET_CONNECT_OVERLAY_ANIMATION}
        blocking={false}
        backdrop={false}
        dismissOnBackPress={false}
        testID="wallet-connect-modal-overlay"
      >
        {content}
      </OverlayView>
    );
  }

  return content;
}

export function GlobalWalletConnectModalContainer() {
  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.WalletConnectOpenModal,
      updatePendingPayload,
    );
    appEventBus.on(EAppEventBusNames.WalletConnectCloseModal, handleCloseModal);
    appEventBus.on(EAppEventBusNames.WalletConnectModalState, handleModalState);
    return () => {
      appEventBus.off(
        EAppEventBusNames.WalletConnectOpenModal,
        updatePendingPayload,
      );
      appEventBus.off(
        EAppEventBusNames.WalletConnectCloseModal,
        handleCloseModal,
      );
      appEventBus.off(
        EAppEventBusNames.WalletConnectModalState,
        handleModalState,
      );
    };
  }, []);

  return <WalletConnectModalGate />;
}
