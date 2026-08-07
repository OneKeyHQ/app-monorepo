import { useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, SizableText } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import storageQuotaUtils from '@onekeyhq/shared/src/storageChecker/storageQuotaUtils';

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
        diagnostics: IAppEventBusPayload[
          EAppEventBusNames.ShowSystemDiskFullWarning
        ],
      ) => {
        await hideFn();
        // Measured numbers, deliberately untranslated: they are what tells a
        // real quota exhaustion apart from a write that failed for some other
        // reason, and users report them back verbatim.
        const detail = storageQuotaUtils.formatDiagnosticsDetail(diagnostics);
        dialogRef.current = Dialog.show({
          icon: 'Disk2Outline',
          tone: 'destructive',
          title: intl.formatMessage({
            id: ETranslations.extension_disk_full,
          }),
          description: intl.formatMessage({
            id: ETranslations.extension_disk_full_desc,
          }),
          renderContent: detail ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {detail}
            </SizableText>
          ) : undefined,
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
