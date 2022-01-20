import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import HardwarePinCode from '../../BasePinCode';
import { OnekeyLiteStackNavigationProp } from '../navigation';
import { OnekeyLiteModalRoutes, OnekeyLiteRoutesParams } from '../routes';

const OnekeyLitePinCode: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        OnekeyLiteRoutesParams,
        OnekeyLiteModalRoutes.OnekeyLitePinCodeRepeatModal
      >
    >();
  console.log('route', route);

  const { callBack } = route.params;

  const navigation = useNavigation<OnekeyLiteStackNavigationProp>();
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
      case OnekeyLiteModalRoutes.OnekeyLitePinCodeCurrentModal.toString():
        setTitle(intl.formatMessage({ id: 'title__enter_current_pin' }));
        setDescription(
          intl.formatMessage({ id: 'title__enter_current_pin_desc' }),
        );
        break;
      case OnekeyLiteModalRoutes.OnekeyLitePinCodeSetModal.toString():
        setTitle(intl.formatMessage({ id: 'title__set_up_new_pin' }));
        setDescription(
          intl.formatMessage({ id: 'title__set_up_new_pin_desc' }),
        );
        break;
      case OnekeyLiteModalRoutes.OnekeyLitePinCodeRepeatModal.toString():
        setTitle(intl.formatMessage({ id: 'title__verify_new_pin' }));
        setDescription(
          intl.formatMessage({ id: 'title__verify_new_pin_desc' }),
        );
        break;
      default:
        break;
    }
  }, [intl, route.name]);

  console.log('route', route);
  return (
    <HardwarePinCode
      title={title}
      description={description}
      securityReminder={intl.formatMessage({
        id: 'content__we_dont_store_any_of_your_information',
      })}
      onComplete={(pinCode) => {
        callBack(pinCode);
        navigation.goBack();
        return Promise.resolve(true);
      }}
    />
  );
};

export default OnekeyLitePinCode;
