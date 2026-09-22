import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useKeylessWalletFeatureIsEnabled } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  OnboardingHeading,
  OnboardingIconBadge,
  OnboardingIconButton,
  OnboardingOrDivider,
  OnboardingPage,
  OnboardingSidebar,
} from '../components/Layout';
import { useAutoStartKeylessProvider } from '../hooks/useAutoStartKeylessProvider';
import { useKeylessLocalExistenceLogin } from '../hooks/useKeylessLocalExistenceLogin';
import { OnboardingTestIDs } from '../testIDs';

import { KeylessOnboardingDebugPanel } from './KeylessOnboardingDebugPanel';

import type { RouteProp } from '@react-navigation/core';

const bullets: ReadonlyArray<{
  icon: IKeyOfIcons;
  titleId: ETranslations;
  descriptionId: ETranslations;
}> = [
  {
    icon: 'LightningOutline',
    titleId: ETranslations.onboarding_benefit_setup_title,
    descriptionId: ETranslations.onboarding_benefit_setup_description,
  },
  {
    icon: 'CubeOutline',
    titleId: ETranslations.onboarding_benefit_security_title,
    descriptionId: ETranslations.onboarding_benefit_security_description,
  },
  {
    icon: 'RenewOutline',
    titleId: ETranslations.onboarding_benefit_recovery_title,
    descriptionId: ETranslations.onboarding_benefit_recovery_description,
  },
];

function CreateNewWallet() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.CreateNewWallet>
    >();

  const autoLoginKeylessProvider = route?.params?.autoLoginKeylessProvider;
  const autoConnectNonce = route?.params?.autoConnectNonce;
  const isWebKeylessSidePanelMode = Boolean(
    route?.params?.fromExt && autoLoginKeylessProvider,
  );
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();
  const [isResetMode, setIsResetMode] = useState(false);

  const {
    enableKeylessWalletLoading,
    loadingProvider,
    handleGoogleLogin,
    handleAppleLogin,
  } = useKeylessLocalExistenceLogin({
    autoLoginKeylessProvider,
    isResetMode,
    onResetModeChange: setIsResetMode,
  });

  const handleCreateSeedPhraseWallet = useCallback(async () => {
    const mnemonic = await backgroundApiProxy.serviceAccount.generateMnemonic();
    const encodedMnemonic =
      await backgroundApiProxy.servicePassword.encodeSensitiveText({
        text: mnemonic,
      });
    const hasCachedPassword =
      await backgroundApiProxy.servicePassword.hasCachedPassword();
    if (hasCachedPassword) {
      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        mnemonic: encodedMnemonic,
        isWalletBackedUp: false,
      });
      defaultLogger.account.wallet.onboard({ onboardMethod: 'createWallet' });
      return;
    }
    navigation.push(EOnboardingPagesV2.CreatePasscode, {
      mnemonic: encodedMnemonic,
      isWalletBackedUp: false,
    });
  }, [navigation]);

  useAutoStartKeylessProvider({
    autoStartProvider: autoLoginKeylessProvider,
    autoStartTriggerKey: autoConnectNonce,
    enabled:
      (isKeylessWalletEnabled || isWebKeylessSidePanelMode) &&
      !enableKeylessWalletLoading,
    onGoogleLogin: handleGoogleLogin,
    onAppleLogin: handleAppleLogin,
  });

  const isGoogleLoading = loadingProvider === EOAuthSocialLoginProvider.Google;
  const isAppleLoading = loadingProvider === EOAuthSocialLoginProvider.Apple;
  // Disable both provider buttons whenever any keyless login/reset is in
  // flight. enableKeylessWalletLoading covers the create/restore path; reset
  // mode only sets loadingProvider, so include it here too.
  const isKeylessLoginInProgress =
    enableKeylessWalletLoading || loadingProvider !== null;

  const { md } = useMedia();

  const actions = (
    <YStack
      gap="$3"
      $md={{
        pt: '$3',
        pb: '$5',
      }}
      $gtMd={{
        flex: 1,
        pt: 88,
        gap: '$5',
      }}
    >
      <OnboardingIconButton
        testID={OnboardingTestIDs.googleSignInButton}
        variant="primary"
        icon="GoogleIllus"
        isLoading={isGoogleLoading}
        disabled={isKeylessLoginInProgress}
        onPress={handleGoogleLogin}
      >
        {intl.formatMessage(
          { id: ETranslations.continue_with_social_platform },
          { platform: 'Google' },
        )}
      </OnboardingIconButton>
      <OnboardingIconButton
        testID={OnboardingTestIDs.appleSignInButton}
        variant="primary"
        icon="AppleBrand"
        isLoading={isAppleLoading}
        disabled={isKeylessLoginInProgress}
        onPress={handleAppleLogin}
      >
        {intl.formatMessage(
          { id: ETranslations.continue_with_social_platform },
          { platform: 'Apple' },
        )}
      </OnboardingIconButton>
      {isWebKeylessSidePanelMode ? null : (
        <>
          {!md ? <OnboardingOrDivider /> : null}
          <OnboardingIconButton
            testID={OnboardingTestIDs.createNewWalletSeedPhraseBtn}
            icon="SecretPhraseOutline"
            onPress={handleCreateSeedPhraseWallet}
          >
            {intl.formatMessage({
              id: ETranslations.create_seed_phrase_wallet,
            })}
          </OnboardingIconButton>
        </>
      )}
      {isWebKeylessSidePanelMode ? null : (
        <KeylessOnboardingDebugPanel
          isResetMode={isResetMode}
          onResetModeChange={setIsResetMode}
        />
      )}
    </YStack>
  );

  // A phone-class window pins the actions under a scrolling page: a long
  // locale on a short screen used to push the last button off a fixed page.
  return (
    <OnboardingPage scrollable={md} footer={md ? actions : undefined}>
      <OnboardingHeading>
        {intl.formatMessage({
          id: ETranslations.onboarding_create_new_wallet,
        })}
      </OnboardingHeading>
      <YStack
        $md={{
          flex: 1,
        }}
        $gtMd={{
          flexDirection: 'row-reverse',
          mt: -40,
        }}
      >
        <OnboardingSidebar $md={{ pt: '$5', pb: '$5' }}>
          {md ? null : <OnboardingIconBadge icon="WalletCryptoSolid" />}
          <YStack gap="$6">
            <SizableText size="$headingMd">
              {intl.formatMessage({
                id: ETranslations.onboarding_keyless_tagline,
              })}
            </SizableText>
            {bullets.map((item) => (
              <XStack key={item.titleId} gap="$5" alignItems="flex-start">
                {md ? (
                  <Icon
                    name={item.icon}
                    color="$iconSubdued"
                    size="$6"
                    flexShrink={0}
                  />
                ) : null}
                <YStack flex={1} gap="$1">
                  <SizableText size="$bodyLgMedium">
                    {intl.formatMessage({ id: item.titleId })}
                  </SizableText>
                  <SizableText size="$bodyLg" color="$textSubdued">
                    {intl.formatMessage({ id: item.descriptionId })}
                  </SizableText>
                </YStack>
              </XStack>
            ))}
          </YStack>
        </OnboardingSidebar>
        {md ? null : actions}
      </YStack>
    </OnboardingPage>
  );
}

function CreateNewWalletWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <CreateNewWallet />
    </AccountSelectorProviderMirror>
  );
}

export default CreateNewWalletWithContext;
