import { useCallback, useEffect, useState } from 'react';

import { Dialog } from '@onekeyhq/components';
import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { PinInputLayout } from '../components/PinInputLayout';

function ConfirmPinPage() {
  const navigation = useAppNavigation();
  const { getKeylessOnboardingPin, cacheKeylessOnboardingPin } =
    useKeylessWallet();

  // Use state to store the PIN, fetched only once on mount
  const [originalPin, setOriginalPin] = useState<string | undefined>(undefined);

  const intl = useIntl();
  const [confirmPin, setConfirmPin] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch PIN only on mount (commit phase), not during render phase
  // This ensures getAndDelete is called only once by the mounted instance
  useEffect(() => {
    const pin = getKeylessOnboardingPin();
    setOriginalPin(pin);
  }, [getKeylessOnboardingPin]);

  const handlePinChange = useCallback(
    (filteredText: string) => {
      setConfirmPin(filteredText);
      setErrorMessage('');

      if (!originalPin) {
        Dialog.show({
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: 'Original PIN is not found. Please try again.',
        });
        return;
      }

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
    setConfirmPin('');
    cacheKeylessOnboardingPin({ pin: originalPin || '' });
    navigation.push(EOnboardingPagesV2.CreatePasscode);
  }, [cacheKeylessOnboardingPin, navigation, originalPin]);

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
