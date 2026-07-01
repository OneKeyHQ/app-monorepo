import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IThirdPartyHardwareUiStateContainerComponent = ComponentType;
type IThirdPartyHardwareUiStateAtomWatcherComponent = ComponentType<{
  onShouldMount: () => void;
}>;
type IShowThirdPartyHardwarePermissionDialogPayload =
  IAppEventBusPayload[EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog];

const THIRD_PARTY_HARDWARE_ATOM_WATCHER_DELAY_MS = platformEnv.isWeb ? 6000 : 0;

function ThirdPartyHardwareUiStateContainerLazyCmp() {
  const [shouldMount, setShouldMount] = useState(false);
  const [ContainerImpl, setContainerImpl] =
    useState<IThirdPartyHardwareUiStateContainerComponent | null>(null);
  const [AtomWatcherImpl, setAtomWatcherImpl] =
    useState<IThirdPartyHardwareUiStateAtomWatcherComponent | null>(null);
  const pendingPermissionPayloadRef = useRef<
    IShowThirdPartyHardwarePermissionDialogPayload | undefined
  >(undefined);
  const permissionPayloadReplayTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const requestMount = useCallback(() => {
    setShouldMount(true);
  }, []);

  useEffect(() => {
    if (AtomWatcherImpl || ContainerImpl) {
      return;
    }
    let isMounted = true;
    const timer = setTimeout(() => {
      void import('./ThirdPartyHardwareUiStateAtomWatcher')
        .then((module) => {
          if (isMounted) {
            setAtomWatcherImpl(
              () => module.ThirdPartyHardwareUiStateAtomWatcher,
            );
          }
        })
        .catch((error: Error) => {
          console.error(
            'Failed to load ThirdPartyHardwareUiStateAtomWatcher:',
            error,
          );
        });
    }, THIRD_PARTY_HARDWARE_ATOM_WATCHER_DELAY_MS);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [AtomWatcherImpl, ContainerImpl]);

  useEffect(() => {
    const handlePermissionDialog = (
      payload: IShowThirdPartyHardwarePermissionDialogPayload,
    ) => {
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
  }, [ContainerImpl, shouldMount]);

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
