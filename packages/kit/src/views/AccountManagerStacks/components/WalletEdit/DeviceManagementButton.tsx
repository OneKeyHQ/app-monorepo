import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useDeviceManagerNavigation } from '../../../DeviceManagement/hooks/useDeviceManagerNavigation';

export function DeviceManagementButton({
  wallet,
  onClose,
}: {
  wallet: IDBWallet | undefined;
  onClose: () => void;
}) {
  const intl = useIntl();
  const { pushToDeviceDetail } = useDeviceManagerNavigation();

  return (
    <ActionList.Item
      icon="StorageOutline"
      label={intl.formatMessage({ id: ETranslations.global_device_management })}
      onPress={async () => {
        pushToDeviceDetail({
          walletId: wallet?.id || '',
        });
      }}
      onClose={onClose}
    />
  );
}
