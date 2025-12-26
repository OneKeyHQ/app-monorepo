import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { PinInputLayout } from '../components/PinInputLayout';

import type { RouteProp } from '@react-navigation/core';

function CreatePinPage() {
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.CreatePin>>();
  const { isResetPin } = route.params ?? {};
  const intl = useIntl();
  const [pin, setPin] = useState('');

  const handleContinue = useCallback(() => {
    navigation.push(EOnboardingPagesV2.ConfirmPin, { pin });
  }, [navigation, pin]);

  const highlightDescription = useCallback(
    (chunks: React.ReactNode) => (
      <SizableText size="$bodyLg" color="$textCaution">
        {chunks}
      </SizableText>
    ),
    [],
  );

  return (
    <PinInputLayout
      title={
        isResetPin
          ? 'Create a new PIN'
          : intl.formatMessage({ id: ETranslations.create_a_pin })
      }
      description={intl.formatMessage(
        { id: ETranslations.create_a_pin_desc },
        {
          highlight: highlightDescription,
        },
      )}
      buttonText={intl.formatMessage({ id: ETranslations.global_continue })}
      value={pin}
      onChange={setPin}
      onSubmit={handleContinue}
      isSubmitDisabled={pin.length !== 4}
    />
  );
}

export { CreatePinPage as default };
