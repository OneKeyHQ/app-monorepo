import { useCallback, useEffect, useState } from 'react';

import { Dialog } from '@onekeyhq/components';
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
    setConfirmPin('');
    cacheKeylessOnboardingPin({ pin: originalPin || '' });
    navigation.push(EOnboardingPagesV2.CreatePasscode);
  }, [cacheKeylessOnboardingPin, navigation, originalPin]);

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
