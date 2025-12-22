import { useCallback, useState } from 'react';

import { SizableText } from '@onekeyhq/components';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { PinInputLayout } from '../components/PinInputLayout';

function CreatePinPage() {
  const navigation = useAppNavigation();
  const [pin, setPin] = useState('');

  const handleContinue = useCallback(() => {
    navigation.push(EOnboardingPagesV2.ConfirmPin, { pin });
  }, [navigation, pin]);

  return (
    <PinInputLayout
      title="Create a PIN"
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

export { CreatePinPage as default };
