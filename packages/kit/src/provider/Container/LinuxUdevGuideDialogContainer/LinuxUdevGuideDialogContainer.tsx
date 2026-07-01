import { useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import { LINUX_UDEV_HELP_URL } from '@onekeyhq/shared/src/config/appConfig';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IEventBusPayloadShowLinuxUdevGuide,
  ILinuxUdevGuideReason,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

// Sandboxed Linux builds and restricted PolicyKit sessions may need manual USB
// permission recovery. When USB access is denied (LIBUSB_ERROR_ACCESS),
// ServiceHardware emits ShowLinuxBundleUdevGuide and we point the user to the
// help article that covers Linux udev rules, Flatpak, and Snap troubleshooting.
function getLinuxUdevGuideUrl(_reason?: ILinuxUdevGuideReason) {
  return LINUX_UDEV_HELP_URL;
}

export function LinuxUdevGuideDialogContainer() {
  const intl = useIntl();
  const dialogRef = useRef<IDialogInstance | null>(null);
  useEffect(() => {
    if (!platformEnv.isDesktopLinux) {
      return;
    }
    const showFn = debounce(
      async (payload: IEventBusPayloadShowLinuxUdevGuide) => {
        const helpUrl = getLinuxUdevGuideUrl(payload?.reason);
        await dialogRef.current?.close();
        dialogRef.current = Dialog.show({
          icon: 'UsbOutline',
          title: intl.formatMessage({
            id: ETranslations.device_grant_usb_access,
          }),
          description: intl.formatMessage({
            id: ETranslations.hardware_device_not_find_error,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_view_tutorial,
          }),
          onConfirm: () => {
            openUrlExternal(helpUrl);
          },
          showCancelButton: true,
        });
      },
      1000,
      {
        leading: true,
        trailing: false,
      },
    );
    appEventBus.on(EAppEventBusNames.ShowLinuxBundleUdevGuide, showFn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowLinuxBundleUdevGuide, showFn);
    };
  }, [intl]);
  return null;
}
