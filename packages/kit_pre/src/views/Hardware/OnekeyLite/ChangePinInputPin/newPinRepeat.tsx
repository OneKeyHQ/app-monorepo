import type { FC } from 'react';
import { useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { OnekeyLiteChangePinRoutesParams } from '@onekeyhq/kit/src/routes';
import { OnekeyLiteChangePinModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import HardwarePinCode from '../../BasePinCode';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<OnekeyLiteChangePinRoutesParams>;

const OnekeyLiteNewRepeatPinCode: FC = () => {
  const intl = useIntl();

  const [description, setDescription] = useState(
    intl.formatMessage({ id: 'title__verify_new_pin_desc' }),
  );
  const route =
    useRoute<
      RouteProp<
        OnekeyLiteChangePinRoutesParams,
        OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinRepeatModal
      >
    >();

  const { currentPin, newPin } = route.params;

  const navigation = useNavigation<NavigationProps['navigation']>();

  return (
    <HardwarePinCode
      title={intl.formatMessage({ id: 'title__verify_new_pin' })}
      description={description}
      securityReminder={intl.formatMessage({
        id: 'content__we_dont_store_any_of_your_information',
      })}
      onComplete={async (pinCode) => {
        const inputSuccess = pinCode === newPin;
        if (!inputSuccess && pinCode !== '') {
          await Promise.resolve();
          setDescription(
            intl.formatMessage({
              id: 'content__for_both_inputs_the_pin_must_be_the_same',
            }),
          );
          return false;
        }

        navigation.popToTop();
        navigation.replace(
          OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinModal,
          {
            oldPin: currentPin,
            newPin,
          },
        );
        return Promise.resolve(true);
      }}
    />
  );
};

export default OnekeyLiteNewRepeatPinCode;
