import { memo, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import { useHardwareUiStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

type IHardwareUiStateContainerComponent = ComponentType;

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
  const [state] = useHardwareUiStateAtom();
  const [shouldMount, setShouldMount] = useState(false);
  const [ContainerImpl, setContainerImpl] =
    useState<IHardwareUiStateContainerComponent | null>(null);
  const containerLoadedRef = useRef(false);
  const pendingEventsRef = useRef<IHardwareUiPendingEvent[]>([]);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    containerLoadedRef.current = !!ContainerImpl;
  }, [ContainerImpl]);

  useEffect(() => {
    if (state) {
      setShouldMount(true);
    }
  }, [state]);

  useEffect(() => {
    const enqueueEvent = (event: IHardwareUiPendingEvent) => {
      if (containerLoadedRef.current) {
        return;
      }
      pendingEventsRef.current.push(event);
      setShouldMount(true);
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
  }, []);

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
  }, [ContainerImpl, shouldMount]);

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
    return null;
  }
  return <ContainerImpl />;
}

export const HardwareUiStateContainerLazy = memo(
  HardwareUiStateContainerLazyCmp,
);
