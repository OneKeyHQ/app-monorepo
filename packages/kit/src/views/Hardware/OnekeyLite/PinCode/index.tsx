import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import HardwarePinCode from '../../BasePinCode';
import {
  OnekeyLitePinStackNavigationProp,
  OnekeyLiteStackNavigationProp,
} from '../navigation';
import { OnekeyLiteModalRoutes, OnekeyLiteRoutesParams } from '../routes';

const OnekeyLitePinCode: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        OnekeyLiteRoutesParams,
        OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal
      >
    >();

  const { callBack } = route.params;

  const navigation = useNavigation<
    OnekeyLiteStackNavigationProp & OnekeyLitePinStackNavigationProp
  >();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    switch (route.name) {
      case OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal.toString():
        setTitle(intl.formatMessage({ id: 'title__onekey_lite_pin' }));
        setDescription(
          intl.formatMessage({
            id: 'content__enter_onekey_lite_pin_to_continue',
          }),
        );
        break;
      default:
        break;
    }
  }, [intl, route.name]);

  return (
    <HardwarePinCode
      title={title}
      description={description}
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
