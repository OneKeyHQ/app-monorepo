import { useEffect, useRef } from 'react';

import { debounce } from 'lodash';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

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
          icon: 'Disk2Outline',
          tone: 'destructive',
          title: appLocale.intl.formatMessage({
            id: ETranslations.extension_disk_full,
          }),
          description: appLocale.intl.formatMessage({
            id: ETranslations.extension_disk_full_desc,
          }),
          dismissOnOverlayPress: false,
          disableDrag: true,
          showCancelButton: false,
          onConfirmText: appLocale.intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
          confirmButtonProps: {
            variant: 'secondary',
          },
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
