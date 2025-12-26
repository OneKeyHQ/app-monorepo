import { Suspense, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText, Spinner, YStack } from '@onekeyhq/components';
import { usePasswordModeAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import PasswordSetup from '../../../components/Password/components/PasswordSetup';
import PasswordSetupContainer from '../../../components/Password/container/PasswordSetupContainer';
import { OnboardingLayout } from '../components/OnboardingLayout';

import type { IPasswordSetupForm } from '../../../components/Password/components/PasswordSetup';

function CreatePasscodePage() {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [passwordMode] = usePasswordModeAtom();

  const handleSetupPasscode = useCallback((data: IPasswordSetupForm) => {
    setLoading(true);
    // TODO: Handle passcode setup
    console.log('Passcode setup:', data);
    setLoading(false);
  }, []);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent gap="$10">
            <YStack gap="$2">
              <SizableText size="$heading2xl">
                {step === 'create'
                  ? intl.formatMessage({
                      id: ETranslations.global_set_passcode,
                    })
                  : intl.formatMessage({
                      id: ETranslations.auth_confirm_passcode_form_label,
                    })}
              </SizableText>
              <SizableText size="$bodyLg" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.create_passcode_desc })}
              </SizableText>
            </YStack>
            <Suspense fallback={<Spinner size="large" />}>
              <PasswordSetupContainer
                pageMode
                onSetupRes={async (data: string) => {
                  alert(data);
                }}
              />
            </Suspense>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export { CreatePasscodePage as default };
