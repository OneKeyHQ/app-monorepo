import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

type IHardwareUiStateContainerComponent = ComponentType;
type IHardwareUiStateAtomWatcherComponent = ComponentType<{
  onShouldMount: () => void;
}>;

type IHardwareUiPendingEvent =
  | {
      type: EAppEventBusNames.ShowHardwareErrorDialog;
      payload: IAppEventBusPayload[EAppEventBusNames.ShowHardwareErrorDialog];
    }
  | {
      type: EAppEventBusNames.RequestHardwareUIDialog;
      payload: IAppEventBusPayload[EAppEventBusNames.RequestHardwareUIDialog];
    };

function HardwareUiStateContainerLazyCmp() {
  const [shouldMount, setShouldMount] = useState(false);
  const [loadRequestSeq, setLoadRequestSeq] = useState(0);
  const [ContainerImpl, setContainerImpl] =
    useState<IHardwareUiStateContainerComponent | null>(null);
  const [AtomWatcherImpl, setAtomWatcherImpl] =
    useState<IHardwareUiStateAtomWatcherComponent | null>(null);
  const containerLoadedRef = useRef(false);
  const pendingEventsRef = useRef<IHardwareUiPendingEvent[]>([]);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestMount = useCallback(() => {
    setShouldMount(true);
    setLoadRequestSeq((value) => value + 1);
  }, []);

  useEffect(() => {
    containerLoadedRef.current = !!ContainerImpl;
  }, [ContainerImpl]);

  useEffect(() => {
    if (AtomWatcherImpl) {
      return;
    }
    let isMounted = true;
    void import('./HardwareUiStateAtomWatcher')
      .then((module) => {
        if (isMounted) {
          setAtomWatcherImpl(() => module.HardwareUiStateAtomWatcher);
        }
      })
      .catch((error: Error) => {
        console.error('Failed to load HardwareUiStateAtomWatcher:', error);
      });
    return () => {
      isMounted = false;
    };
  }, [AtomWatcherImpl, loadRequestSeq]);

  useEffect(() => {
    const enqueueEvent = (event: IHardwareUiPendingEvent) => {
      if (containerLoadedRef.current) {
        return;
      }
      pendingEventsRef.current.push(event);
      requestMount();
    };
    const handleHardwareErrorDialog = (
      payload: IAppEventBusPayload[EAppEventBusNames.ShowHardwareErrorDialog],
    ) => {
      enqueueEvent({
        type: EAppEventBusNames.ShowHardwareErrorDialog,
        payload,
      });
    };
    const handleRequestHardwareUiDialog = (
      payload: IAppEventBusPayload[EAppEventBusNames.RequestHardwareUIDialog],
    ) => {
      enqueueEvent({
        type: EAppEventBusNames.RequestHardwareUIDialog,
        payload,
      });
    };
    appEventBus.on(
      EAppEventBusNames.ShowHardwareErrorDialog,
      handleHardwareErrorDialog,
    );
    appEventBus.on(
      EAppEventBusNames.RequestHardwareUIDialog,
      handleRequestHardwareUiDialog,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowHardwareErrorDialog,
        handleHardwareErrorDialog,
      );
      appEventBus.off(
        EAppEventBusNames.RequestHardwareUIDialog,
        handleRequestHardwareUiDialog,
      );
    };
  }, [requestMount]);

  useEffect(() => {
    if (!shouldMount || ContainerImpl) {
      return;
    }
    let isMounted = true;
    void import('./HardwareUiStateContainer')
      .then((module) => {
        if (isMounted) {
          setContainerImpl(() => module.HardwareUiStateContainer);
        }
      })
      .catch((error: Error) => {
        console.error('Failed to load HardwareUiStateContainer:', error);
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
      for (const event of pendingEvents) {
        if (event.type === EAppEventBusNames.ShowHardwareErrorDialog) {
          appEventBus.emit(event.type, event.payload);
        } else {
          appEventBus.emit(event.type, event.payload);
        }
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
    return AtomWatcherImpl ? (
      <AtomWatcherImpl onShouldMount={requestMount} />
    ) : null;
  }
  return (
    <>
      <ContainerImpl />
      {AtomWatcherImpl ? (
        <AtomWatcherImpl onShouldMount={requestMount} />
      ) : null}
    </>
  );
}

export const HardwareUiStateContainerLazy = memo(
  HardwareUiStateContainerLazyCmp,
);
