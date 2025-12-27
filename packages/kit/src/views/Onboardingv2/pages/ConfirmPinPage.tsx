import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Button, Dialog } from '@onekeyhq/components';
import { EKeylessFinalizeAction } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { PinInputLayout } from '../components/PinInputLayout';

import { KeylessOnboardingDebugPanel } from './KeylessOnboardingDebugPanel';

function ConfirmPinPage() {
  const navigation = useAppNavigation();
  const {
    confirmKeylessOnboardingPin,
    getKeylessOnboardingPin,
    handleKeylessOnboardingTimeout,
  } = useKeylessWallet();

  const intl = useIntl();
  const [confirmPin, setConfirmPin] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePinChange = useCallback(
    async (filteredText: string) => {
      setConfirmPin(filteredText);
      setErrorMessage('');

      // Auto-validate when 4 digits entered
      if (filteredText.length === 4) {
        const originalPin = await getKeylessOnboardingPin({ skipDelete: true });
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
    await confirmKeylessOnboardingPin({
      pin: originalPin || '',
      action: EKeylessFinalizeAction.Create,
    });
  }, [
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
