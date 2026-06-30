import { memo, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import {
  useThirdPartyAppInstallAtom,
  useThirdPartyBatchInstallAtom,
  useThirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

type IThirdPartyHardwareUiStateContainerComponent = ComponentType;
type IShowThirdPartyHardwarePermissionDialogPayload =
  IAppEventBusPayload[EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog];

function ThirdPartyHardwareUiStateContainerLazyCmp() {
  const [uiState] = useThirdPartyHardwareUiStateAtom();
  const [appInstallState] = useThirdPartyAppInstallAtom();
  const [batchInstallState] = useThirdPartyBatchInstallAtom();
  const [shouldMount, setShouldMount] = useState(false);
  const [ContainerImpl, setContainerImpl] =
    useState<IThirdPartyHardwareUiStateContainerComponent | null>(null);
  const pendingPermissionPayloadRef = useRef<
    IShowThirdPartyHardwarePermissionDialogPayload | undefined
  >(undefined);
  const permissionPayloadReplayTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    if (uiState || appInstallState || batchInstallState) {
      setShouldMount(true);
    }
  }, [appInstallState, batchInstallState, uiState]);

  useEffect(() => {
    const handlePermissionDialog = (
      payload: IShowThirdPartyHardwarePermissionDialogPayload,
    ) => {
      pendingPermissionPayloadRef.current = payload;
      setShouldMount(true);
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
  }, []);

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
    return null;
  }
  return <ContainerImpl />;
}

export const ThirdPartyHardwareUiStateContainerLazy = memo(
  ThirdPartyHardwareUiStateContainerLazyCmp,
);
