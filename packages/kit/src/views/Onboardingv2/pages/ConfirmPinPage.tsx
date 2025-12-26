import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';

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
          setErrorMessage('Incorrect PIN. Please try again.');
          setIsValid(false);
        }
      } else {
        setIsValid(false);
      }
    },
    [originalPin],
  );

  const handleConfirm = useCallback(() => {
    navigation.push(EOnboardingPagesV2.CreatePasscode);
  }, [navigation]);

  return (
    <PinInputLayout
      title="Confirm your PIN"
      description="If you forget this PIN, you will not be able to recover your wallet on a new device."
      descriptionColor="$textCaution"
      buttonText="Confirm"
      value={confirmPin}
      onChange={handlePinChange}
      onSubmit={handleConfirm}
      isSubmitDisabled={!isValid}
      errorMessage={errorMessage}
    />
  );
}

export { ConfirmPinPage as default };
