import { useCallback, useState } from 'react';

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

  const handlePinChange = useCallback(
    async (filteredText: string) => {
      setConfirmPin(filteredText);
      setErrorMessage('');

      // Auto-validate when 4 digits entered
      if (filteredText.length === 4) {
        const originalPin = await getKeylessOnboardingPin();
        if (!originalPin) {
          handleKeylessOnboardingTimeout();
          return;
        }
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
    [getKeylessOnboardingPin, handleKeylessOnboardingTimeout, intl],
  );

  const handleConfirm = useCallback(async () => {
    setConfirmPin('');
    const originalPin = await getKeylessOnboardingPin();
    if (!originalPin) {
      handleKeylessOnboardingTimeout();
      return;
    }
    try {
      setIsLoading(true);
      await confirmKeylessOnboardingPin({
        pin: originalPin || '',
        action,
      });
    } finally {
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
