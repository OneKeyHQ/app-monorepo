import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { TouchableWithoutFeedback } from 'react-native';

import {
  Button,
  Dialog,
  SizableText,
  useClipboard,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { exportLogs } from './logs';

export const StateLogsItem = () => {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const onPress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.settings_export_state_logs,
      }),
      renderContent: (
        <SizableText>
          <SizableText size="$bodyLg">
            {intl.formatMessage({
              id: ETranslations.settings_export_state_logs_desc,
            })}
          </SizableText>
          <TouchableWithoutFeedback
            onPress={() => {
              copyText('hi@onekey.so');
            }}
          >
            <Button variant="tertiary" size="medium" iconAfter="Copy1Outline">
              hi@onekey.so
            </Button>
          </TouchableWithoutFeedback>
        </SizableText>
      ),
      confirmButtonProps: {
        variant: 'primary',
      },
      onConfirmText: intl.formatMessage({ id: ETranslations.global_export }),
      onConfirm: () => {
        const str = new Date().toISOString().replace(/[-:.]/g, '');
        void exportLogs(`OneKeyLogs-${str}`);
      },
    });
  }, [copyText, intl]);
  return (
    <ListItem
      icon="FileDownloadOutline"
      onPress={onPress}
      title={intl.formatMessage({
        id: ETranslations.settings_export_state_logs,
      })}
      drillIn
    />
  );
};
