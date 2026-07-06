import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

type IThirdPartyHardwareUiStateContainerComponent = ComponentType;
type IThirdPartyHardwareUiStateAtomWatcherComponent = ComponentType<{
  onShouldMount: () => void;
}>;
type IShowThirdPartyHardwarePermissionDialogPayload =
  IAppEventBusPayload[EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog];

function ThirdPartyHardwareUiStateContainerLazyCmp() {
  const [shouldMount, setShouldMount] = useState(false);
  const [loadRequestSeq, setLoadRequestSeq] = useState(0);
  const [ContainerImpl, setContainerImpl] =
    useState<IThirdPartyHardwareUiStateContainerComponent | null>(null);
  const [AtomWatcherImpl, setAtomWatcherImpl] =
    useState<IThirdPartyHardwareUiStateAtomWatcherComponent | null>(null);
  const containerLoadedRef = useRef(false);
  const pendingPermissionPayloadRef = useRef<
    IShowThirdPartyHardwarePermissionDialogPayload | undefined
  >(undefined);
  const permissionPayloadReplayTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
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
    void import('./ThirdPartyHardwareUiStateAtomWatcher')
      .then((module) => {
        if (isMounted) {
          setAtomWatcherImpl(() => module.ThirdPartyHardwareUiStateAtomWatcher);
        }
      })
      .catch((error: Error) => {
        console.error(
          'Failed to load ThirdPartyHardwareUiStateAtomWatcher:',
          error,
        );
      });
    return () => {
      isMounted = false;
    };
  }, [AtomWatcherImpl, loadRequestSeq]);

  useEffect(() => {
    const handlePermissionDialog = (
      payload: IShowThirdPartyHardwarePermissionDialogPayload,
    ) => {
      if (containerLoadedRef.current) {
        return;
      }
      pendingPermissionPayloadRef.current = payload;
      requestMount();
    };
    appEventBus.on(
      EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog,
      handlePermissionDialog,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog,
        handlePermissionDialog,
      );
    };
  }, [requestMount]);

  useEffect(() => {
    if (!shouldMount || ContainerImpl) {
      return;
    }
    let isMounted = true;
    void import('./index')
      .then((module) => {
        if (isMounted) {
          setContainerImpl(() => module.ThirdPartyHardwareUiStateContainer);
        }
      })
      .catch((error: Error) => {
        console.error(
          'Failed to load ThirdPartyHardwareUiStateContainer:',
          error,
        );
      });
    return () => {
      isMounted = false;
    };
  }, [ContainerImpl, loadRequestSeq, shouldMount]);

  useEffect(() => {
    if (!ContainerImpl || !pendingPermissionPayloadRef.current) {
      return;
    }
    const payload = pendingPermissionPayloadRef.current;
    pendingPermissionPayloadRef.current = undefined;
    permissionPayloadReplayTimerRef.current = setTimeout(() => {
      appEventBus.emit(
        EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog,
        payload,
      );
    }, 0);
    return () => {
      if (permissionPayloadReplayTimerRef.current) {
        clearTimeout(permissionPayloadReplayTimerRef.current);
        permissionPayloadReplayTimerRef.current = null;
      }
    };
  }, [ContainerImpl]);

  useEffect(
    () => () => {
      if (permissionPayloadReplayTimerRef.current) {
        clearTimeout(permissionPayloadReplayTimerRef.current);
        permissionPayloadReplayTimerRef.current = null;
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

export const ThirdPartyHardwareUiStateContainerLazy = memo(
  ThirdPartyHardwareUiStateContainerLazyCmp,
);
