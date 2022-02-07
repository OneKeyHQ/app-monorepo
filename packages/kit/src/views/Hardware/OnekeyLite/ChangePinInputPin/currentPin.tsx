import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import HardwarePinCode from '../../BasePinCode';
import { OnekeyLitePinStackNavigationProp } from '../navigation';
import { OnekeyLitePinModalRoutes } from '../routes';

const OnekeyLiteCurrentPinCode: FC = () => {
  const intl = useIntl();

  const navigation = useNavigation<OnekeyLitePinStackNavigationProp>();

  return (
    <HardwarePinCode
      title={intl.formatMessage({ id: 'title__enter_current_pin' })}
      description={intl.formatMessage({ id: 'title__enter_current_pin_desc' })}
      securityReminder={intl.formatMessage({
        id: 'content__we_dont_store_any_of_your_information',
      })}
      onComplete={(pinCode) => {
        navigation.navigate(
          OnekeyLitePinModalRoutes.OnekeyLitePinCodeSetModal,
          { currentPin: pinCode },
        );
        return Promise.resolve(true);
      }}
    />
  );
};

export default OnekeyLiteCurrentPinCode;
