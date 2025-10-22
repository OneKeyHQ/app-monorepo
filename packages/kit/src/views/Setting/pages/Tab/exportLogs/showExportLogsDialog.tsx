import { useCallback } from 'react';

import { Dialog, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

type ICopyTextFn = (
  text: string,
  successMessageId?: ETranslations,
  showToast?: boolean,
) => void;

type IOnExportFn = (fileName?: string) => void | Promise<void>;

function ExportLogsDialogContent({
  intl,
  copyText,
}: {
  intl: IntlShape;
  copyText: ICopyTextFn;
}) {
  const handleEmailPress = useCallback(() => {
    copyText('hi@onekey.so');
  }, [copyText]);

  return (
    <Stack>
      <SizableText size="$bodyLg">
        {intl.formatMessage({
          id: ETranslations.settings_logs_do_not_include_sensitive_data,
        })}
      </SizableText>
      <Stack h="$5" />
      <SizableText size="$bodyLg">
        {intl.formatMessage(
          {
            id: ETranslations.settings_export_state_logs_desc,
          },
          {
            email: (
              <SizableText
                size="$bodyLg"
                textDecorationLine="underline"
                onPress={handleEmailPress}
              >
                hi@onekey.so
              </SizableText>
            ),
          },
        )}
      </SizableText>
    </Stack>
  );
}

export function showExportLogsDialog({
  intl,
  copyText,
  onExport,
}: {
  intl: IntlShape;
  copyText: ICopyTextFn;
  onExport: IOnExportFn;
}) {
  return Dialog.show({
    icon: 'FileDownloadOutline',
    title: intl.formatMessage({
      id: ETranslations.settings_export_state_logs,
    }),
    renderContent: <ExportLogsDialogContent intl={intl} copyText={copyText} />,
    confirmButtonProps: {
      variant: 'primary',
    },
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_export,
    }),
    onConfirm: () => {
      const fileBaseName = new Date().toISOString().replace(/[-:.]/g, '');
      void onExport(`OneKeyLogs-${fileBaseName}`);
    },
  });
}
