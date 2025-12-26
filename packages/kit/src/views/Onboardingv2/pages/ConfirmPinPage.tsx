import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { PinInputLayout } from '../components/PinInputLayout';

import type { RouteProp } from '@react-navigation/core';

function ConfirmPinPage() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.ConfirmPin>
    >();
  const { pin: originalPin } = route.params;
  const intl = useIntl();
  const [confirmPin, setConfirmPin] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePinChange = useCallback(
    (filteredText: string) => {
      setConfirmPin(filteredText);
      setErrorMessage('');

      // Auto-validate when 4 digits entered
      if (filteredText.length === 4) {
        if (filteredText === originalPin) {
          setIsValid(true);
        } else {
          setErrorMessage(
            intl.formatMessage({ id: ETranslations.incorrect_pin }),
          );
          setIsValid(false);
        }
      } else {
        setIsValid(false);
      }
    },
    [originalPin, intl],
  );

  const handleConfirm = useCallback(() => {
    navigation.push(EOnboardingPagesV2.CreatePasscode);
  }, [navigation]);

  return (
    <PinInputLayout
      title={intl.formatMessage({ id: ETranslations.confirm_your_pin })}
      description={intl.formatMessage({
        id: ETranslations.confirm_your_pin_desc,
      })}
      descriptionColor="$textCaution"
      buttonText={intl.formatMessage({ id: ETranslations.global_confirm })}
      value={confirmPin}
      onChange={handlePinChange}
      onSubmit={handleConfirm}
      isSubmitDisabled={!isValid}
      errorMessage={errorMessage}
    />
  );
}

export { ConfirmPinPage as default };
