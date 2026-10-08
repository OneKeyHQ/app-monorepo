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
import type { IStorageFullDiagnostics } from '@onekeyhq/shared/src/storageChecker/types';

/**
 * Storage headroom line shown under the warning copy: how much of the granted
 * quota is left. For an extension the quota — not the physical disk — is the
 * binding write limit, so this is the number that explains the warning to a
 * user staring at a half-empty drive.
 *
 * Only the translated label plus formatted sizes are rendered. `reason` and the
 * originating error message are diagnostics, not UI copy: they have no
 * translation keys (and the locale files are generated, so they cannot be
 * hand-added here), and they already go to `defaultLogger`, which is where a
 * support engineer reads them from an exported log.
 */
function buildStorageHeadroomText(
  diagnostics: IStorageFullDiagnostics | undefined,
  availableLabel: string,
): string | undefined {
  const quotaInfo = diagnostics?.quotaInfo;
  if (!quotaInfo) {
    return undefined;
  }
  return `${availableLabel}: ${storageQuotaUtils.formatGB(
    quotaInfo.availableBytes,
  )} / ${storageQuotaUtils.formatGB(quotaInfo.quotaBytes)}`;
}

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
        diagnostics: IAppEventBusPayload[EAppEventBusNames.ShowSystemDiskFullWarning],
      ) => {
        await hideFn();
        const detail = buildStorageHeadroomText(
          diagnostics,
          intl.formatMessage({ id: ETranslations.global_available }),
        );
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
