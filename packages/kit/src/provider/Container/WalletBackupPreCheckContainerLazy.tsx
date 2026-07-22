import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

type IWalletBackupPreCheckContainerComponent = ComponentType;

type IWalletBackupPreCheckPendingEvent =
  IAppEventBusPayload[EAppEventBusNames.CheckWalletBackupStatus];

function WalletBackupPreCheckContainerLazyCmp() {
  const [shouldMount, setShouldMount] = useState(false);
  const [loadRequestSeq, setLoadRequestSeq] = useState(0);
  const [ContainerImpl, setContainerImpl] =
    useState<IWalletBackupPreCheckContainerComponent | null>(null);
  const containerLoadedRef = useRef(false);
  const pendingEventsRef = useRef<IWalletBackupPreCheckPendingEvent[]>([]);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    containerLoadedRef.current = !!ContainerImpl;
  }, [ContainerImpl]);

  const requestMount = useCallback(() => {
    setShouldMount(true);
    setLoadRequestSeq((value) => value + 1);
  }, []);

  useEffect(() => {
    const handleCheckWalletBackupStatus = (
      payload: IWalletBackupPreCheckPendingEvent,
    ) => {
      if (containerLoadedRef.current) {
        return;
      }
      pendingEventsRef.current.push(payload);
      requestMount();
    };
    appEventBus.on(
      EAppEventBusNames.CheckWalletBackupStatus,
      handleCheckWalletBackupStatus,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.CheckWalletBackupStatus,
        handleCheckWalletBackupStatus,
      );
    };
  }, [requestMount]);

  useEffect(() => {
    if (!shouldMount || ContainerImpl) {
      return;
    }
    let isMounted = true;
    void import('../../components/WalletBackup/WalletBackupPreCheckContainer')
      .then((module) => {
        if (isMounted) {
          setContainerImpl(() => module.WalletBackupPreCheckContainer);
        }
      })
      .catch((error: Error) => {
        console.error('Failed to load WalletBackupPreCheckContainer:', error);
      });
    return () => {
      isMounted = false;
    };
  }, [ContainerImpl, loadRequestSeq, shouldMount]);

  useEffect(() => {
    if (!ContainerImpl || pendingEventsRef.current.length === 0) {
      return;
    }
    const pendingEvents = [...pendingEventsRef.current];
    pendingEventsRef.current = [];
    replayTimerRef.current = setTimeout(() => {
      for (const payload of pendingEvents) {
        appEventBus.emit(EAppEventBusNames.CheckWalletBackupStatus, payload);
      }
    }, 0);
    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [ContainerImpl]);

  useEffect(
    () => () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    },
    [],
  );

  if (!ContainerImpl) {
    return null;
  }
  return <ContainerImpl />;
}

export const WalletBackupPreCheckContainerLazy = memo(
  WalletBackupPreCheckContainerLazyCmp,
);
