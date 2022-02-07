import React, { FC } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import HardwarePinCode from '../../BasePinCode';
import {
  OnekeyLitePinStackNavigationProp,
  OnekeyLiteStackNavigationProp,
} from '../navigation';
import {
  OnekeyLiteModalRoutes,
  OnekeyLitePinModalRoutes,
  OnekeyLitePinRoutesParams,
} from '../routes';

const OnekeyLiteNewRepeatPinCode: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        OnekeyLitePinRoutesParams,
        OnekeyLitePinModalRoutes.OnekeyLitePinCodeRepeatModal
      >
    >();

  const { currentPin, newPin } = route.params;

  const navigation = useNavigation<
    OnekeyLitePinStackNavigationProp & OnekeyLiteStackNavigationProp
  >();

  return (
    <HardwarePinCode
      title={intl.formatMessage({ id: 'title__verify_new_pin' })}
      description={intl.formatMessage({ id: 'title__verify_new_pin_desc' })}
      securityReminder={intl.formatMessage({
        id: 'content__we_dont_store_any_of_your_information',
      })}
      onComplete={(pinCode) => {
        const inputSuccess = pinCode === newPin;
        if (!inputSuccess) {
          return Promise.resolve(false);
        }
        navigation.replace(OnekeyLiteModalRoutes.OnekeyLiteChangePinModal, {
          oldPin: currentPin,
          newPin,
          onRetry: () => {
            navigation.replace(
              OnekeyLitePinModalRoutes.OnekeyLitePinCodeChangePinModal,
            );
          },
        });
        return Promise.resolve(true);
      }}
    />
  );
};

export default OnekeyLiteNewRepeatPinCode;
