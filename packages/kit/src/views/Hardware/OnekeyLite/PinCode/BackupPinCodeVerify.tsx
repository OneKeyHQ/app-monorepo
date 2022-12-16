import { FC } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { CreateWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import HardwarePinCode from '../../BasePinCode';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal
>;

const OnekeyLitePinCode: FC = () => {
  const intl = useIntl();

  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { walletId, backupData, onSuccess } = route.params;

  return (
    <HardwarePinCode
      title={intl.formatMessage({ id: 'title__onekey_lite_pin' })}
      description={intl.formatMessage({
        id: 'content__enter_onekey_lite_pin_to_continue',
      })}
      securityReminder={intl.formatMessage({
        id: 'content__we_dont_store_any_of_your_information',
      })}
      onComplete={(pinCode) => {
        navigation.replace(CreateWalletModalRoutes.OnekeyLiteBackupModal, {
          walletId,
          pinCode,
          backupData,
          onSuccess,
        });
        return Promise.resolve(true);
      }}
    />
  );
};

export default OnekeyLitePinCode;
