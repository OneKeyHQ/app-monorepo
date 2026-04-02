import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { EKeylessFinalizeAction } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
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
  const { action } = route.params ?? {};
  const isResetPin = action === EKeylessFinalizeAction.ResetPin;
  const { cacheKeylessOnboardingPin } = useKeylessWallet();

  const intl = useIntl();
  const [pin, setPin] = useState('');

  const handleContinue = useCallback(async () => {
    if (pin) {
      await cacheKeylessOnboardingPin({ pin });
      setPin('');
      navigation.push(EOnboardingPagesV2.ConfirmPin, { action });
    }
  }, [action, cacheKeylessOnboardingPin, navigation, pin]);

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
          ? intl.formatMessage({ id: ETranslations.create_a_new_pin })
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
