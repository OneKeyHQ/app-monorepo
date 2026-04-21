import { Suspense, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Spinner, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import PasswordSetupContainer from '../../../components/Password/container/PasswordSetupContainer';
import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  OnboardingHeading,
  OnboardingIconBadge,
  OnboardingPage,
  OnboardingSidebar,
} from '../components/Layout';

function PasscodeFormView() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { result: isPasswordSet } = usePromiseResult(async () => {
    return backgroundApiProxy.servicePassword.checkPasswordSet();
  }, []);
  const { finalizeKeylessWalletV2 } = useKeylessWallet();
  const route = useAppRoute<
    IOnboardingParamListV2,
    EOnboardingPagesV2.CreatePasscode
  >();

  const handlePasscodeConfirm = useCallback(
    async (_passcode: string) => {
      const mnemonic = route?.params?.mnemonic;
      if (mnemonic) {
        navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
          mnemonic,
          isWalletBackedUp: route?.params?.isWalletBackedUp ?? false,
        });
        defaultLogger.account.wallet.onboard({ onboardMethod: 'createWallet' });
        return;
      }
      await finalizeKeylessWalletV2({ action: route?.params?.action });
    },
    [
      finalizeKeylessWalletV2,
      navigation,
      route?.params?.action,
      route?.params?.mnemonic,
      route?.params?.isWalletBackedUp,
    ],
  );

  if (isPasswordSet === undefined) {
    return <Spinner size="large" />;
  }
  let formView = null;
  if (isPasswordSet) {
    formView = (
      <Suspense fallback={<Spinner size="large" />}>
        <PasswordVerifyContainer pageMode onVerifyRes={handlePasscodeConfirm} />
      </Suspense>
    );
  } else {
    formView = (
      <Suspense fallback={<Spinner size="large" />}>
        <PasswordSetupContainer pageMode onSetupRes={handlePasscodeConfirm} />
      </Suspense>
    );
  }
  return (
    <>
      <YStack gap="$2">
        <OnboardingHeading>
          {!isPasswordSet
            ? intl.formatMessage({
                id: ETranslations.global_set_passcode,
              })
            : intl.formatMessage({
                id: ETranslations.auth_confirm_passcode_form_label,
              })}
        </OnboardingHeading>
        {!isPasswordSet ? (
          <SizableText size="$bodyLg" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.create_passcode_desc })}
          </SizableText>
        ) : null}
      </YStack>
      {formView}
    </>
  );
}

function CreatePasscodePage() {
  const { gtMd } = useMedia();
  const intl = useIntl();
  return (
    <OnboardingPage
      contentContainerProps={{
        $gtMd: { minHeight: 600, flexDirection: 'row' },
      }}
    >
      <YStack
        w="100%"
        $md={{ flex: 1 }}
        $gtMd={{ flexDirection: 'row', alignSelf: 'flex-start' }}
      >
        <YStack flex={1} gap="$10">
          <PasscodeFormView />
        </YStack>
        {gtMd ? (
          <OnboardingSidebar>
            <OnboardingIconBadge icon="LockSolid" />
            <YStack gap="$4">
              <SizableText size="$bodyLg">
                {intl.formatMessage({
                  id: ETranslations.onboarding_passcode_tip,
                })}
              </SizableText>
            </YStack>
          </OnboardingSidebar>
        ) : null}
      </YStack>
    </OnboardingPage>
  );
}

function CreatePasscodePageWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <CreatePasscodePage />
    </AccountSelectorProviderMirror>
  );
}

export { CreatePasscodePageWithContext as default };
