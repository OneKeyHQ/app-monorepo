import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalDeviceManagementRoutes } from '@onekeyhq/shared/src/routes/deviceManagement';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';

export function DeviceManagementButton({
  wallet,
  onClose,
}: {
  wallet: IDBWallet | undefined;
  onClose: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return (
    <ActionList.Item
      icon="StorageOutline"
      label={intl.formatMessage({ id: ETranslations.global_device_management })}
      onPress={async () => {
        navigation.pushModal(EModalRoutes.DeviceManagementModal, {
          screen: EModalDeviceManagementRoutes.DeviceDetailModal,
          params: {
            walletId: wallet?.id || '',
          },
        });
      }}
      onClose={onClose}
    />
  );
}
