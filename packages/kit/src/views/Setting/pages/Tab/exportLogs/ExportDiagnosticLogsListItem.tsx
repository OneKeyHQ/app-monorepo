import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SettingTestIDs } from '../../../testIDs';
import { TabSettingsListItem } from '../ListItem';

import { showDiagnosticLogsContentsDialog } from './showDiagnosticLogsContentsDialog';
import { showExportLogsDialog } from './showExportLogsDialog';

import type { ICustomElementProps } from '../CustomElement';
import type { GestureResponderEvent } from 'react-native';

export function ExportDiagnosticLogsListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const intl = useIntl();

  const handlePress = useCallback(async () => {
    await dismissKeyboardWithDelay(100);
    logItemClick?.();
    void showExportLogsDialog({
      title: intl.formatMessage({
        id: ETranslations.settings_upload_state_logs,
      }),
    });
  }, [intl, logItemClick]);

  const handleLearnMorePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      void showDiagnosticLogsContentsDialog({ intl });
    },
    [intl],
  );

  return (
    <TabSettingsListItem
      {...props}
      testID={SettingTestIDs.exportDiagnosticLogsItem}
      drillIn
      onPress={handlePress}
      subtitle={
        <YStack gap="$1" mt="$0.5" flexShrink={1} userSelect="none">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_export_diagnostic_logs__desc,
            })}
          </SizableText>
          <Stack
            alignSelf="flex-start"
            cursor="default"
            testID={SettingTestIDs.exportDiagnosticLogsHelpLink}
            onPress={handleLearnMorePress}
          >
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              textDecorationLine="underline"
              cursor="default"
              hoverStyle={{ color: '$text' }}
            >
              {intl.formatMessage({
                id: ETranslations.settings_diagnostic_logs_contents__title,
              })}
            </SizableText>
          </Stack>
        </YStack>
      }
    />
  );
}
