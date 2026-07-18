import { useCallback, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
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
import { OnboardingTestIDs } from '../testIDs';

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

  const isContinuingRef = useRef(false);

  // Re-arm the submit guard when navigating back from ConfirmPin
  useFocusEffect(
    useCallback(() => {
      isContinuingRef.current = false;
    }, []),
  );

  const handleContinue = useCallback(async () => {
    if (!pin || isContinuingRef.current) {
      return;
    }
    // Close the same-tick re-entry window (double Enter) so ConfirmPin
    // cannot be pushed twice; navigation.push does not dedupe.
    isContinuingRef.current = true;
    try {
      await cacheKeylessOnboardingPin({ pin });
      setPin('');
      navigation.push(EOnboardingPagesV2.ConfirmPin, { action });
    } catch (e) {
      isContinuingRef.current = false;
      throw e;
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
      testID={OnboardingTestIDs.createPasscodePage}
      inputTestID={OnboardingTestIDs.passcodeInput}
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
