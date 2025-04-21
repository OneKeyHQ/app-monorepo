import { useEffect, useRef } from 'react';

import { debounce } from 'lodash';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

export function DiskFullWarningDialogContainer() {
  const dialogRef = useRef<IDialogInstance | null>(null);
  useEffect(() => {
    const hideFn = async () => {
      await dialogRef.current?.close();
    };
    const showFn = debounce(
      async (
        _: IAppEventBusPayload[EAppEventBusNames.ShowSystemDiskFullWarning],
      ) => {
        await hideFn();
        dialogRef.current = Dialog.show({
          title: 'System Disk Full',
          description:
            'The system disk is full. Please clean up some space, then restart the app.',
          dismissOnOverlayPress: false,
          disableDrag: true,
        });
      },
      1000,
      {
        leading: true,
        trailing: false,
      },
    );
    appEventBus.on(EAppEventBusNames.ShowSystemDiskFullWarning, showFn);
    // appEventBus.on(EAppEventBusNames.HideSystemDiskFullWarning, hideFn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowSystemDiskFullWarning, showFn);
      // appEventBus.off(EAppEventBusNames.HideSystemDiskFullWarning, hideFn);
    };
  }, []);
  return null;
}
