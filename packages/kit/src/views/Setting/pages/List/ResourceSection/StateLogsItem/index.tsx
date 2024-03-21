import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { exportLogs } from './logs';

export const StateLogsItem = () => {
  const intl = useIntl();
  const onPress = useCallback(() => {
    Dialog.show({
      title: 'Export State Logs',
      description:
        'This will help OneKey support debug any issue you might encounter. Please send to hi@onekey.so or OneKey support only.',
      confirmButtonProps: {
        variant: 'primary',
      },
      onConfirmText: 'Export',
      onConfirm: () => {
        defaultLogger.common.logDeviceInfo();
        const str = new Date().toISOString().replace(/[-:.]/g, '');
        void exportLogs(`OneKeyLogs-${str}`);
      },
    });
  }, []);
  return (
    <ListItem
      icon="FileDownloadOutline"
      onPress={onPress}
      title={intl.formatMessage({ id: 'content__state_logs' })}
    />
  );
};
