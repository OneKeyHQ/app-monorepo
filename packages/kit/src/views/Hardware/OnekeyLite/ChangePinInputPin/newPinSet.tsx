import type { FC } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type {
  OnekeyLiteChangePinRoutesParams,
  OnekeyLiteResetRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { OnekeyLiteChangePinModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import HardwarePinCode from '../../BasePinCode';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<OnekeyLiteResetRoutesParams> &
  ModalScreenProps<OnekeyLiteChangePinRoutesParams>;

const OnekeyLiteNewSetPinCode: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        OnekeyLiteChangePinRoutesParams,
        OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinSetModal
      >
    >();

  const { currentPin } = route.params;

  const navigation = useNavigation<NavigationProps['navigation']>();

  return (
    <HardwarePinCode
      title={intl.formatMessage({ id: 'title__set_up_new_pin' })}
      description={intl.formatMessage({ id: 'title__set_up_new_pin_desc' })}
      securityReminder={intl.formatMessage({
        id: 'content__we_dont_store_any_of_your_information',
      })}
      onComplete={(pinCode) => {
        navigation.navigate(
          OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinRepeatModal,
          { currentPin, newPin: pinCode },
        );
        return Promise.resolve('');
      }}
    />
  );
};

export default OnekeyLiteNewSetPinCode;
