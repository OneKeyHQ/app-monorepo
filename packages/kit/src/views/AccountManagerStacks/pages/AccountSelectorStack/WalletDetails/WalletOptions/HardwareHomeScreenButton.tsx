import { useIntl } from 'react-intl';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { WalletOptionItem } from './WalletOptionItem';

export function HardwareHomeScreenButton({
  device,
}: {
  device: IDBDevice | undefined;
}) {
  const intl = useIntl();
  // TODO home screen support check
  /*
  if (!connectId || !hwInfo.hwWalletType) return;
      const hasHomeScreen = getHomescreenKeys(hwInfo.hwWalletType).length > 0;
      if (
        hwInfo.hwWalletType === 'mini' ||
        hwInfo.hwWalletType === 'classic' ||
        hwInfo.hwWalletType === 'classic1s'
      ) {
        setShowHomeScreenSetting(hasHomeScreen);
        return;
      }
      const res = await serviceHardware.getDeviceSupportFeatures(connectId);
      setShowHomeScreenSetting(!!res.modifyHomescreen.support && hasHomeScreen);
      */
  const navigation = useAppNavigation();
  return (
    <WalletOptionItem
      icon="AiImagesOutline"
      // global::homescreen
      // global::crop_image
      label={intl.formatMessage({ id: ETranslations.global_homescreen })}
      onPress={() => {
        if (!device) return;
        navigation.pushModal(EModalRoutes.AccountManagerStacks, {
          screen: EAccountManagerStacksRoutes.HardwareHomeScreenModal,
          params: {
            device,
          },
        });
      }}
    />
  );
}
