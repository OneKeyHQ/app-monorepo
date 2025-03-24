import { useIntl } from 'react-intl';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalDeviceManagementRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { WalletOptionItem } from './WalletOptionItem';

function DeviceManagementButtonView({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return (
    <WalletOptionItem
      testID="account-device-management-details"
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
    />
  );
}

export function DeviceManagementButton({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <DeviceManagementButtonView wallet={wallet} />
    </AccountSelectorProviderMirror>
  );
}
