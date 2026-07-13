import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

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

function WalletConnectEventBridge({
  payload,
  onReady,
  onUnavailable,
}: {
  payload: IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal] | null;
  onReady: (
    replayedPayload:
      | IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal]
      | null,
  ) => void;
  onUnavailable: () => void;
}) {
  useEffect(() => () => onUnavailable(), [onUnavailable]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onReady(payload);
      if (payload) {
        appEventBus.emitToSelf({
          type: EAppEventBusNames.WalletConnectOpenModal,
          payload,
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [onReady, payload]);
  return null;
}

export function GlobalWalletConnectModalContainer() {
  const [pendingPayload, setPendingPayload] = useState<
    IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal] | null
  >(null);
  const [shouldMountContainer, setShouldMountContainer] = useState(false);
  const isContainerReadyRef = useRef(false);

  useEffect(() => {
    const onOpen = (
      p: IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal],
    ) => {
      if (!isContainerReadyRef.current) {
        setPendingPayload(p);
        setShouldMountContainer(true);
      }
    };
    const onClose = () => {
      if (!isContainerReadyRef.current) {
        setPendingPayload(null);
      }
    };
    appEventBus.on(EAppEventBusNames.WalletConnectOpenModal, onOpen);
    appEventBus.on(EAppEventBusNames.WalletConnectCloseModal, onClose);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectOpenModal, onOpen);
      appEventBus.off(EAppEventBusNames.WalletConnectCloseModal, onClose);
    };
  }, []);

  const handleContainerReady = useCallback(
    (
      replayedPayload:
        | IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal]
        | null,
    ) => {
      isContainerReadyRef.current = true;
      if (replayedPayload) {
        setPendingPayload((current) =>
          current === replayedPayload ? null : current,
        );
      }
    },
    [],
  );
  const handleContainerUnavailable = useCallback(() => {
    isContainerReadyRef.current = false;
  }, []);

  const container = shouldMountContainer ? (
    <Suspense fallback={null}>
      <WalletConnectModalContainerLazy />
      <WalletConnectEventBridge
        payload={pendingPayload}
        onReady={handleContainerReady}
        onUnavailable={handleContainerUnavailable}
      />
    </Suspense>
  ) : null;

  return platformEnv.isNativeIOS ? (
    <Page.Every>{container}</Page.Every>
  ) : (
    container
  );
}
