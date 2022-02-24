import React, { FC } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import HardwarePinCode from '../../BasePinCode';
import { OnekeyLiteChangePinStackNavigationProp } from '../navigation';
import {
  OnekeyLiteChangePinModalRoutes,
  OnekeyLiteChangePinRoutesParams,
} from '../routes';

const OnekeyLiteNewRepeatPinCode: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        OnekeyLiteChangePinRoutesParams,
        OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinRepeatModal
      >
    >();

  const { currentPin, newPin } = route.params;

  const navigation = useNavigation<OnekeyLiteChangePinStackNavigationProp>();

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

        navigation.popToTop();
        navigation.replace(
          OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinModal,
          {
            oldPin: currentPin,
            newPin,
            onRetry: () => {
              navigation.replace(
                OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinInputPinModal,
              );
            },
          },
        );
        return Promise.resolve(true);
      }}
    />
  );
};

export default OnekeyLiteNewRepeatPinCode;
