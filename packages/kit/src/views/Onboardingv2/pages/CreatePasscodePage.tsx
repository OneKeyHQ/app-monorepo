import { Suspense, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText, Spinner, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import PasswordSetupContainer from '../../../components/Password/container/PasswordSetupContainer';
import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { OnboardingLayout } from '../components/OnboardingLayout';

function PasscodeFormView() {
  const intl = useIntl();
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
      await finalizeKeylessWalletV2({ action: route?.params?.action });
    },
    [finalizeKeylessWalletV2, route.params.action],
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
        <SizableText size="$heading2xl">
          {!isPasswordSet
            ? intl.formatMessage({
                id: ETranslations.global_set_passcode,
              })
            : intl.formatMessage({
                id: ETranslations.auth_confirm_passcode_form_label,
              })}
        </SizableText>
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
  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent gap="$10">
            <PasscodeFormView />
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
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
