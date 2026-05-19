import { useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function DiskFullWarningDialogContainer() {
  const intl = useIntl();
  const dialogRef = useRef<IDialogInstance | null>(null);
  useEffect(() => {
    if (platformEnv.isWebDappMode) {
      return;
    }
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
          title: intl.formatMessage({
            id: ETranslations.extension_disk_full,
          }),
          description: intl.formatMessage({
            id: ETranslations.extension_disk_full_desc,
          }),
          dismissOnOverlayPress: false,
          disableDrag: true,
          showCancelButton: false,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
          confirmButtonProps: {
            testID: 'disk-full-warning-confirm-btn',
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
  }, [intl]);
  return null;
}
