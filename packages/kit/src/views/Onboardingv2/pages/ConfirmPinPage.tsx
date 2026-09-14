import { useCallback, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { EKeylessFinalizeAction } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import { PinInputLayout } from '../components/PinInputLayout';
import { OnboardingTestIDs } from '../testIDs';

import type { RouteProp } from '@react-navigation/core';

function ConfirmPinPage() {
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.ConfirmPin>
    >();
  const { action = EKeylessFinalizeAction.Create } = route.params ?? {};
  const {
    confirmKeylessOnboardingPin,
    getKeylessOnboardingPin,
    handleKeylessOnboardingTimeout,
  } = useKeylessWallet();

  const intl = useIntl();
  const [confirmPin, setConfirmPin] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isConfirmingRef = useRef(false);
  const validationRequestIdRef = useRef(0);
  const validatedRequestIdRef = useRef<number | undefined>(undefined);

  const handlePinChange = useCallback(
    async (filteredText: string) => {
      if (isConfirmingRef.current) {
        return;
      }
      validationRequestIdRef.current += 1;
      const validationRequestId = validationRequestIdRef.current;
      setConfirmPin(filteredText);
      setIsValid(false);
      setErrorMessage('');

      // Auto-validate when 4 digits entered
      if (filteredText.length === 4) {
        const originalPin = await getKeylessOnboardingPin();
        // Ignore validation for input that was changed or cleared on submit.
        if (validationRequestId !== validationRequestIdRef.current) {
          return;
        }
        if (!originalPin) {
          handleKeylessOnboardingTimeout();
          return;
        }
        if (filteredText === originalPin) {
          validatedRequestIdRef.current = validationRequestId;
          setIsValid(true);
        } else {
          setErrorMessage(
            intl.formatMessage({ id: ETranslations.incorrect_pin }),
          );
        }
      }
    },
    [getKeylessOnboardingPin, handleKeylessOnboardingTimeout, intl],
  );

  const handleConfirm = useCallback(async () => {
    // Require validation for the current input even before React commits.
    if (
      validatedRequestIdRef.current !== validationRequestIdRef.current ||
      isConfirmingRef.current
    ) {
      return;
    }
    // Close the same-tick re-entry window before isLoading commits.
    isConfirmingRef.current = true;
    validationRequestIdRef.current += 1;
    setIsLoading(true);
    setConfirmPin('');
    setIsValid(false);
    try {
      const originalPin = await getKeylessOnboardingPin();
      if (!originalPin) {
        handleKeylessOnboardingTimeout();
        return;
      }
      await confirmKeylessOnboardingPin({
        pin: originalPin || '',
        action,
      });
    } finally {
      isConfirmingRef.current = false;
      setIsLoading(false);
    }
  }, [
    action,
    confirmKeylessOnboardingPin,
    getKeylessOnboardingPin,
    handleKeylessOnboardingTimeout,
  ]);

  return (
    <PinInputLayout
      testID={OnboardingTestIDs.confirmPinPage}
      inputTestID={OnboardingTestIDs.confirmPasscodeInput}
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
      isLoading={isLoading}
      isInputDisabled={isLoading}
      errorMessage={errorMessage}
    />
  );
}

function ConfirmPinPageWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <ConfirmPinPage />
    </AccountSelectorProviderMirror>
  );
}

export { ConfirmPinPageWithContext as default };
