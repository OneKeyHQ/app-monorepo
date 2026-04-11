import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useRoute } from '@react-navigation/core';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  DecorativeOneKeyLogo,
  Dialog,
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import {
  useKeylessWallet,
  useKeylessWalletFeatureIsEnabled,
} from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { WalletAvatar } from '../../../components/WalletAvatar';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { TermsAndPrivacy } from '../../Onboarding/pages/GetStarted/components';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useAutoStartKeylessProvider } from '../hooks/useAutoStartKeylessProvider';

import type { RouteProp } from '@react-navigation/core';

const DEVICE_SIZE = 24;

export const AnimatedDeviceAvatar = memo(
  ({ deviceSize }: { deviceSize: number }) => {
    const themeVariant = useThemeVariant();

    const deviceData: (keyof typeof HwWalletAvatarImages)[] = useMemo(() => {
      return [
        themeVariant === 'light' ? `${EDeviceType.Pro}White` : EDeviceType.Pro,
        EDeviceType.Classic,
        EDeviceType.Touch,
        ...(!platformEnv.isNative ? [EDeviceType.Mini] : []),
      ];
    }, [themeVariant]);

    const [enableAnimation, setEnableAnimation] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => {
        setEnableAnimation(true);
      }, 100);

      return () => clearTimeout(timer);
    }, []);

    return (
      <YStack w="$5" h={deviceSize} overflow="hidden" alignItems="center">
        {enableAnimation ? (
          <MotiView
            from={{
              translateY: 0,
            }}
            animate={{
              translateY: Array.from(
                { length: deviceData.length },
                (_, index) => ({
                  type: 'spring',
                  value: -index * deviceSize,
                  delay: 1000,
                }),
              ),
            }}
            transition={{
              loop: true,
            }}
          >
            <YStack>
              {deviceData.map((device, index) => (
                <WalletAvatar
                  key={index}
                  wallet={undefined}
                  img={device}
                  size={deviceSize}
                />
              ))}
            </YStack>
          </MotiView>
        ) : (
          <YStack>
            <WalletAvatar
              wallet={undefined}
              img={deviceData[0]}
              size={deviceSize}
            />
          </YStack>
        )}
      </YStack>
    );
  },
);

AnimatedDeviceAvatar.displayName = 'AnimatedDeviceAvatar';

function GetStarted() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.GetStarted>
    >();
  const handleGetStarted = () => {
    navigation.push(EOnboardingPagesV2.PickYourDevice);
    defaultLogger.account.wallet.onboard({ onboardMethod: 'connectHWWallet' });
  };
  const intl = useIntl();
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();
  const { enableKeylessWalletLoading, checkKeylessWalletLocalExistence } =
    useKeylessWallet();

  // Track which provider is currently loading
  const [loadingProvider, setLoadingProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);

  const handleCreateOrImportWallet = () => {
    navigation.push(EOnboardingPagesV2.CreateOrImportWallet);
  };

  const autoLoginKeylessProvider = route?.params?.autoLoginKeylessProvider;
  const autoConnectNonce = route?.params?.autoConnectNonce;
  const isWebKeylessSidePanelMode = Boolean(
    route?.params?.fromExt && autoLoginKeylessProvider,
  );
  const loadingDialogRef = useRef<IDialogInstance | null>(null);

  const handleGoogleLogin = useCallback(async () => {
    setLoadingProvider(EOAuthSocialLoginProvider.Google);
    try {
      defaultLogger.account.wallet.onboard({
        onboardMethod: 'createKeylessWallet',
      });
      if (autoLoginKeylessProvider) {
        loadingDialogRef.current = Dialog.loading({
          title: intl.formatMessage(
            {
              id: ETranslations.continue_with_social_platform,
            },
            { platform: 'Google' },
          ),
          description: 'OneKey is connecting to your Google account...',
        });
      }
      await checkKeylessWalletLocalExistence({
        signInProvider: EOAuthSocialLoginProvider.Google,
      });
    } finally {
      setLoadingProvider(null);
      void loadingDialogRef.current?.close();
    }
  }, [checkKeylessWalletLocalExistence, intl, autoLoginKeylessProvider]);

  const handleAppleLogin = useCallback(async () => {
    setLoadingProvider(EOAuthSocialLoginProvider.Apple);
    try {
      defaultLogger.account.wallet.onboard({
        onboardMethod: 'createKeylessWallet',
      });
      if (autoLoginKeylessProvider) {
        loadingDialogRef.current = Dialog.loading({
          title: intl.formatMessage(
            {
              id: ETranslations.continue_with_social_platform,
            },
            { platform: 'Apple' },
          ),
          description: 'OneKey is connecting to your Apple account...',
        });
      }
      await checkKeylessWalletLocalExistence({
        signInProvider: EOAuthSocialLoginProvider.Apple,
      });
    } finally {
      setLoadingProvider(null);
      void loadingDialogRef.current?.close();
    }
  }, [checkKeylessWalletLocalExistence, intl, autoLoginKeylessProvider]);

  useAutoStartKeylessProvider({
    autoStartProvider: autoLoginKeylessProvider,
    autoStartTriggerKey: autoConnectNonce,
    enabled:
      (isKeylessWalletEnabled || isWebKeylessSidePanelMode) &&
      !enableKeylessWalletLoading,
    onGoogleLogin: handleGoogleLogin,
    onAppleLogin: handleAppleLogin,
  });

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header showBackButton={false}>
          <OnboardingLayout.Back exit />
        </OnboardingLayout.Header>
        <OnboardingLayout.Body scrollable={false} constrained={false}>
          <YStack flex={1} justifyContent="center" alignItems="center">
            <YStack
              gap={38}
              justifyContent="center"
              alignItems="center"
              pb={58}
            >
              <DecorativeOneKeyLogo />
              <Stack gap="$4" minWidth="$80" zIndex={1}>
                {isWebKeylessSidePanelMode ? null : (
                  <Button
                    size="large"
                    variant="primary"
                    alignSelf="stretch"
                    childrenAsText={false}
                    onPress={handleGetStarted}
                  >
                    <XStack alignItems="center" gap="$2">
                      <AnimatedDeviceAvatar deviceSize={DEVICE_SIZE} />
                      <SizableText size="$bodyLgMedium" color="$textInverse">
                        {intl.formatMessage({
                          id: ETranslations.global_connect_hardware_wallet,
                        })}
                      </SizableText>
                    </XStack>
                  </Button>
                )}
                {isKeylessWalletEnabled || isWebKeylessSidePanelMode ? (
                  <>
                    <Button
                      bg="$gray3"
                      hoverStyle={{ bg: '$gray4' }}
                      pressStyle={{ bg: '$gray5' }}
                      size="large"
                      alignSelf="stretch"
                      childrenAsText={false}
                      onPress={
                        enableKeylessWalletLoading
                          ? undefined
                          : handleGoogleLogin
                      }
                    >
                      <XStack gap="$2" alignItems="center">
                        <AnimatePresence exitBeforeEnter initial={false}>
                          {enableKeylessWalletLoading &&
                          loadingProvider ===
                            EOAuthSocialLoginProvider.Google ? (
                            <YStack
                              key="loading"
                              animation="quick"
                              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                              enterStyle={{ scale: 0.7, opacity: 0 }}
                              exitStyle={{ scale: 0.7, opacity: 0 }}
                            >
                              <Spinner size="small" />
                            </YStack>
                          ) : (
                            <YStack
                              key="icon"
                              animation="quick"
                              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                              enterStyle={{ scale: 0.7, opacity: 0 }}
                              exitStyle={{ scale: 0.7, opacity: 0 }}
                            >
                              <Icon name="GoogleIllus" size="$5" />
                            </YStack>
                          )}
                        </AnimatePresence>
                        <SizableText size="$bodyLgMedium">
                          {intl.formatMessage(
                            { id: ETranslations.continue_with_social_platform },
                            { platform: 'Google' },
                          )}
                        </SizableText>
                      </XStack>
                    </Button>
                    <Button
                      bg="$gray3"
                      hoverStyle={{ bg: '$gray4' }}
                      pressStyle={{ bg: '$gray5' }}
                      size="large"
                      alignSelf="stretch"
                      childrenAsText={false}
                      onPress={
                        enableKeylessWalletLoading
                          ? undefined
                          : handleAppleLogin
                      }
                    >
                      <XStack gap="$2" alignItems="center">
                        <AnimatePresence exitBeforeEnter initial={false}>
                          {enableKeylessWalletLoading &&
                          loadingProvider ===
                            EOAuthSocialLoginProvider.Apple ? (
                            <YStack
                              key="loading"
                              animation="quick"
                              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                              enterStyle={{ scale: 0.7, opacity: 0 }}
                              exitStyle={{ scale: 0.7, opacity: 0 }}
                            >
                              <Spinner size="small" />
                            </YStack>
                          ) : (
                            <YStack
                              key="icon"
                              animation="quick"
                              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                              enterStyle={{ scale: 0.7, opacity: 0 }}
                              exitStyle={{ scale: 0.7, opacity: 0 }}
                            >
                              <Icon name="AppleBrand" size="$5" />
                            </YStack>
                          )}
                        </AnimatePresence>
                        <SizableText size="$bodyLgMedium">
                          {intl.formatMessage(
                            { id: ETranslations.continue_with_social_platform },
                            { platform: 'Apple' },
                          )}
                        </SizableText>
                      </XStack>
                    </Button>
                    {isWebKeylessSidePanelMode ? null : (
                      <Button
                        variant="tertiary"
                        size="large"
                        alignSelf="stretch"
                        mx="$0"
                        onPress={handleCreateOrImportWallet}
                      >
                        {intl.formatMessage({
                          id: ETranslations.more_options,
                        })}
                      </Button>
                    )}
                  </>
                ) : null}
                {!isKeylessWalletEnabled && !isWebKeylessSidePanelMode ? (
                  <Button
                    bg="$gray3"
                    hoverStyle={{ bg: '$gray4' }}
                    pressStyle={{ bg: '$gray5' }}
                    size="large"
                    alignSelf="stretch"
                    childrenAsText={false}
                    onPress={handleCreateOrImportWallet}
                  >
                    <XStack gap="$2" alignItems="center">
                      <Icon name="PlusLargeOutline" size="$5" />
                      <SizableText size="$bodyLgMedium">
                        {intl.formatMessage({
                          id: ETranslations.onboarding_create_or_import_wallet,
                        })}
                      </SizableText>
                    </XStack>
                  </Button>
                ) : null}
              </Stack>
            </YStack>
          </YStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <TermsAndPrivacy />
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}

function GetStartedWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <GetStarted />
    </AccountSelectorProviderMirror>
  );
}
export default GetStartedWithContext;
