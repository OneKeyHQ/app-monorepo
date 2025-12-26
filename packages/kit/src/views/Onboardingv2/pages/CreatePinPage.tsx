import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import { SizableText } from '@onekeyhq/components';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { PinInputLayout } from '../components/PinInputLayout';

import type { RouteProp } from '@react-navigation/core';

function CreatePinPage() {
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.CreatePin>>();
  const { isResetPin } = route.params ?? {};
  const { cacheKeylessOnboardingPin } = useKeylessWallet();

  const [pin, setPin] = useState('');

  const handleContinue = useCallback(() => {
    if (pin) {
      cacheKeylessOnboardingPin({ pin });
      setPin('');
      navigation.push(EOnboardingPagesV2.ConfirmPin);
    }
  }, [cacheKeylessOnboardingPin, navigation, pin]);

  return (
    <PinInputLayout
      title={isResetPin ? 'Create a new PIN' : 'Create a PIN'}
      description={
        <>
          This is used to secure your wallet on all your devices.{' '}
          <SizableText size="$bodyLg" color="$textCaution">
            This cannot be recovered.
          </SizableText>
        </>
      }
      buttonText="Continue"
      value={pin}
      onChange={setPin}
      onSubmit={handleContinue}
      isSubmitDisabled={pin.length !== 4}
    />
  );
}

function CreatePinPageWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <CreatePinPage />
    </AccountSelectorProviderMirror>
  );
}

export { CreatePinPageWithContext as default };
