import React, { FC } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
  OnekeyLiteChangePinRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import HardwarePinCode from '../../BasePinCode';

type NavigationProps = ModalScreenProps<OnekeyLiteChangePinRoutesParams>;
const OnekeyLitePinCode: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        CreateWalletRoutesParams,
        CreateWalletModalRoutes.OnekeyLitePinCodeVerifyModal
      >
    >();

  const { callBack } = route.params;

  const navigation = useNavigation<NavigationProps['navigation']>();

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
        navigation.goBack();
        callBack(pinCode);
        return Promise.resolve(true);
      }}
    />
  );
};

export default OnekeyLitePinCode;
