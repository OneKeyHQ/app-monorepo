import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Icon,
  SizableText,
  Spinner,
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

  return (
    <OnboardingPage>
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
        <OnboardingSidebar $md={{ pt: '$5' }}>
          {md ? null : <OnboardingIconBadge icon="EmailSparkleSolid" />}
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
        <YStack
          gap="$3"
          $md={{
            mt: 'auto',
            pb: '$5',
          }}
          $gtMd={{
            flex: 1,
            pt: 88,
            gap: '$5',
          }}
        >
          <Button
            testID={OnboardingTestIDs.googleSignInButton}
            variant="primary"
            size="large"
            alignSelf="stretch"
            childrenAsText={false}
            disabled={isKeylessLoginInProgress}
            onPress={handleGoogleLogin}
          >
            <YStack position="absolute" left="$5">
              {isGoogleLoading ? (
                <Spinner size="small" color="$iconInverse" />
              ) : (
                <Icon name="GoogleIllus" size="$5" color="$iconInverse" />
              )}
            </YStack>
            <SizableText size="$bodyLgMedium" color="$textInverse">
              {intl.formatMessage(
                { id: ETranslations.continue_with_social_platform },
                { platform: 'Google' },
              )}
            </SizableText>
          </Button>
          <Button
            testID={OnboardingTestIDs.appleSignInButton}
            variant="primary"
            size="large"
            alignSelf="stretch"
            childrenAsText={false}
            disabled={isKeylessLoginInProgress}
            onPress={handleAppleLogin}
          >
            <YStack position="absolute" left="$5">
              {isAppleLoading ? (
                <Spinner size="small" color="$iconInverse" />
              ) : (
                <Icon name="AppleBrand" size="$5" color="$iconInverse" />
              )}
            </YStack>
            <SizableText size="$bodyLgMedium" color="$textInverse">
              {intl.formatMessage(
                { id: ETranslations.continue_with_social_platform },
                { platform: 'Apple' },
              )}
            </SizableText>
          </Button>
          {isWebKeylessSidePanelMode ? null : (
            <>
              {!md ? <OnboardingOrDivider /> : null}
              <Button
                testID={OnboardingTestIDs.createNewWalletSeedPhraseBtn}
                size="large"
                alignSelf="stretch"
                childrenAsText={false}
                onPress={handleCreateSeedPhraseWallet}
              >
                <Icon
                  name="SecretPhraseOutline"
                  position="absolute"
                  left="$5"
                  size="$5"
                  color="$icon"
                />
                <SizableText size="$bodyLgMedium" color="$text">
                  {intl.formatMessage({
                    id: ETranslations.create_seed_phrase_wallet,
                  })}
                </SizableText>
              </Button>
            </>
          )}
          {isWebKeylessSidePanelMode ? null : (
            <KeylessOnboardingDebugPanel
              isResetMode={isResetMode}
              onResetModeChange={setIsResetMode}
            />
          )}
        </YStack>
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
