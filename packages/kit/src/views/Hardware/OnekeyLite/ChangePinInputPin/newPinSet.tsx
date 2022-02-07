import React, { FC } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import HardwarePinCode from '../../BasePinCode';
import {
  OnekeyLitePinStackNavigationProp,
  OnekeyLiteStackNavigationProp,
} from '../navigation';
import { OnekeyLitePinModalRoutes, OnekeyLitePinRoutesParams } from '../routes';

const OnekeyLiteNewSetPinCode: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        OnekeyLitePinRoutesParams,
        OnekeyLitePinModalRoutes.OnekeyLitePinCodeSetModal
      >
    >();

  const { currentPin } = route.params;

  const navigation = useNavigation<
    OnekeyLiteStackNavigationProp & OnekeyLitePinStackNavigationProp
  >();

  return (
    <HardwarePinCode
      title={intl.formatMessage({ id: 'title__set_up_new_pin' })}
      description={intl.formatMessage({ id: 'title__set_up_new_pin_desc' })}
      securityReminder={intl.formatMessage({
        id: 'content__we_dont_store_any_of_your_information',
      })}
      onComplete={(pinCode) => {
        navigation.navigate(
          OnekeyLitePinModalRoutes.OnekeyLitePinCodeRepeatModal,
          { currentPin, newPin: pinCode },
        );
        return Promise.resolve(true);
      }}
    />
  );
};

export default OnekeyLiteNewSetPinCode;
