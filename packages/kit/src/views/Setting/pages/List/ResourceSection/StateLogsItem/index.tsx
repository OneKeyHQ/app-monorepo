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

import { exportLogs } from './logs';

export const StateLogsItem = () => {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const onPress = useCallback(() => {
    Dialog.show({
      title: 'Export State Logs',
      renderContent: (
        <SizableText>
          <SizableText size="$bodyLg">
            This will help OneKey support debug any issue you might encounter.
            Please send to OneKey support or
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
      onConfirmText: 'Export',
      onConfirm: () => {
        const str = new Date().toISOString().replace(/[-:.]/g, '');
        void exportLogs(`OneKeyLogs-${str}`);
      },
    });
  }, [copyText]);
  return (
    <ListItem
      icon="FileDownloadOutline"
      onPress={onPress}
      title={intl.formatMessage({ id: 'content__state_logs' })}
      drillIn
    />
  );
};
