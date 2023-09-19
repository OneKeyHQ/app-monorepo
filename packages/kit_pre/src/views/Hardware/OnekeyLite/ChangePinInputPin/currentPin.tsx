import type { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { OnekeyLiteChangePinRoutesParams } from '@onekeyhq/kit/src/routes';
import { OnekeyLiteChangePinModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import HardwarePinCode from '../../BasePinCode';

type NavigationProps = ModalScreenProps<OnekeyLiteChangePinRoutesParams>;

const OnekeyLiteCurrentPinCode: FC = () => {
  const intl = useIntl();

  const navigation = useNavigation<NavigationProps['navigation']>();

  return (
    <HardwarePinCode
      title={intl.formatMessage({ id: 'title__enter_current_pin' })}
      description={intl.formatMessage({ id: 'title__enter_current_pin_desc' })}
      securityReminder={intl.formatMessage({
        id: 'content__we_dont_store_any_of_your_information',
      })}
      onComplete={(pinCode) => {
        navigation.navigate(
          OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinSetModal,
          { currentPin: pinCode },
        );
        return Promise.resolve('');
      }}
    />
  );
};

export default OnekeyLiteCurrentPinCode;
