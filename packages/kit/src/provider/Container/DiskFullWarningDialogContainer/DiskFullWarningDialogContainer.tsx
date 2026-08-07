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
 * Compose the diagnostic detail line shown under the warning copy.
 *
 * Presentation lives here rather than in `shared` so the UI layer owns it, but
 * the labels stay technical on purpose: there are no ETranslations keys for
 * "quota" / "used" / the reason values, and the locale files are generated —
 * they cannot be hand-edited to add them. Numbers plus a stable reason token
 * are also what users copy verbatim into support reports, so they are worth
 * keeping unambiguous. `available` uses the one key that does exist.
 */
function buildDiagnosticsDetail(
  diagnostics: IStorageFullDiagnostics | undefined,
  availableLabel: string,
): string | undefined {
  if (!diagnostics) {
    return undefined;
  }
  const lines: string[] = [];
  const { quotaInfo } = diagnostics;
  if (quotaInfo) {
    lines.push(
      [
        `Quota ${storageQuotaUtils.formatGB(quotaInfo.quotaBytes)}`,
        `Used ${storageQuotaUtils.formatGB(quotaInfo.usageBytes)}`,
        `${availableLabel} ${storageQuotaUtils.formatGB(
          quotaInfo.availableBytes,
        )}`,
      ].join(' · '),
    );
  }
  lines.push(`Reason: ${diagnostics.reason}`);
  if (diagnostics.errorMessage) {
    lines.push(`Error: ${diagnostics.errorMessage}`);
  }
  return lines.join('\n');
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
        // Tells a real quota exhaustion apart from a write that failed for
        // some other reason — the translated copy alone cannot express that.
        const detail = buildDiagnosticsDetail(
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
