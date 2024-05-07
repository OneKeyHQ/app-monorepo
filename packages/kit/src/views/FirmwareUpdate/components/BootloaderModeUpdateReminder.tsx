import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

export function BootloaderModeUpdateReminder() {
  const navigation = useAppNavigation();
  const actions = useFirmwareUpdateActions();

  useEffect(() => {
    const fn = () => {
      actions.showBootloaderMode();
    };
    appEventBus.on(EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode, fn);

    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode,
        fn,
      );
    };
  }, [actions, navigation]);
  return null;
}
