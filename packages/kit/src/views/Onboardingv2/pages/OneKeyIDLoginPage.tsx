import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Anchor,
  AnimatePresence,
  Icon,
  Page,
  SizableText,
  Spinner,
  Toast,
  YStack,
} from '@onekeyhq/components';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingV2OneKeyIDLoginMode } from '@onekeyhq/shared/src/routes';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import { ListItem } from '../../../components/ListItem';
import { useOneKeyAuth } from '../../../components/OneKeyAuth/useOneKeyAuth';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { OnboardingLayout } from '../components/OnboardingLayout';

import { KeylessOnboardingDebugPanel } from './KeylessOnboardingDebugPanel';

function OptionItem({
  icon,
  iconProps,
  title,
  isLoading,
  onPress,
}: {
  icon: IKeyOfIcons;
  iconProps?: IIconProps;
  title: string;
  isLoading?: boolean;
  onPress?: () => void;
}) {
  return (
    <ListItem
      gap="$3"
      bg="$bg"
      $platform-web={{
        boxShadow:
          '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      $theme-dark={{
        bg: '$neutral2',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      borderRadius="$5"
      borderCurve="continuous"
      p="$3"
      m="$0"
      onPress={onPress}
      userSelect="none"
    >
      <YStack
        borderRadius="$full"
        bg="$neutral2"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$neutral2"
        p="$2"
      >
        <Icon name={icon} {...iconProps} />
      </YStack>
      <YStack gap={2} flex={1}>
        <SizableText size="$bodyLgMedium">{title}</SizableText>
      </YStack>
      <YStack w="$6" h="$6" alignItems="center" justifyContent="center">
        <AnimatePresence initial={false} exitBeforeEnter>
          {isLoading ? (
            <YStack
              key="loading-spinner"
              animation="quick"
              animateOnly={['transform', 'opacity']}
              enterStyle={{ scale: 0.7, opacity: 0 }}
              exitStyle={{ scale: 0.7, opacity: 0 }}
            >
              <Spinner size="small" />
            </YStack>
          ) : (
            <YStack
              key="chevron-right"
              animation="quick"
              enterStyle={{ scale: 0.7, opacity: 0 }}
              exitStyle={{ scale: 0.7, opacity: 0 }}
            >
              <Icon name="ChevronRightSmallOutline" color="$iconDisabled" />
            </YStack>
          )}
        </AnimatePresence>
      </YStack>
    </ListItem>
  );
}

function OneKeyIDLoginPage() {
  const [loggingInProvider, setLoggingInProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const route = useAppRoute<
    IOnboardingParamListV2,
    EOnboardingPagesV2.OneKeyIDLogin
  >();
  const loggingInProviderRef = useRef<EOAuthSocialLoginProvider | null>(null);
  loggingInProviderRef.current = loggingInProvider;
  const mode: EOnboardingV2OneKeyIDLoginMode | undefined = route?.params?.mode;
  const requiredProvider = route?.params?.provider;
  const intl = useIntl();

  const isVerifyMode =
    mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin ||
    mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly;

  const { signInWithSocialLogin } = useOneKeyAuth();
  const { checkKeylessWalletCreatedOnServer } = useKeylessWallet();

  const handleSocialLogin = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (loggingInProviderRef.current) {
        return;
      }
      try {
        setLoggingInProvider(provider);
        const result = await signInWithSocialLogin(provider);
        if (result?.session?.accessToken) {
          if (isResetMode) {
            await backgroundApiProxy.serviceKeylessWallet.apiResetKeylessBackendShare(
              {
                token: result.session.accessToken,
              },
            );
            Toast.success({
              title: 'Reset Success',
            });
            setIsResetMode(false);
          } else {
            // Track wallet creation started after OAuth login succeeds
            if (!isVerifyMode) {
              defaultLogger.account.wallet.addWalletStarted({
                addMethod: 'CreateKeylessWallet',
                isSoftwareWalletOnlyUser: true,
                details: {
                  provider:
                    provider === EOAuthSocialLoginProvider.Google
                      ? 'google'
                      : 'apple',
                },
              });
            }
            await checkKeylessWalletCreatedOnServer({
              token: result.session.accessToken,
              refreshToken: result.session.refreshToken,
              mode,
            });
          }
        }
      } finally {
        setLoggingInProvider(null);
      }
    },
    [
      checkKeylessWalletCreatedOnServer,
      isResetMode,
      isVerifyMode,
      mode,
      signInWithSocialLogin,
    ],
  );

  const handleGoogleLogin = useCallback(async () => {
    await handleSocialLogin(EOAuthSocialLoginProvider.Google);
  }, [handleSocialLogin]);

  const handleAppleLogin = useCallback(async () => {
    await handleSocialLogin(EOAuthSocialLoginProvider.Apple);
  }, [handleSocialLogin]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body
          constrained={false}
          scrollable={!platformEnv.isNative}
        >
          <OnboardingLayout.ConstrainedContent gap="$10">
            <YStack gap="$2">
              <SizableText size="$heading3xl">
                {isVerifyMode
                  ? intl.formatMessage({
                      id: ETranslations.keyless_verify_identity_title,
                    })
                  : intl.formatMessage({ id: ETranslations.select_your_email })}
              </SizableText>
              <SizableText size="$bodyLg" color="$textSubdued">
                {isVerifyMode
                  ? intl.formatMessage(
                      { id: ETranslations.keyless_verify_identity_desc },
                      {
                        provider:
                          requiredProvider === EOAuthSocialLoginProvider.Apple
                            ? 'Apple'
                            : 'Google',
                      },
                    )
                  : intl.formatMessage({
                      id: ETranslations.select_your_email_desc,
                    })}
              </SizableText>
            </YStack>
            <YStack gap="$3">
              {!requiredProvider ||
              requiredProvider === EOAuthSocialLoginProvider.Google ? (
                <OptionItem
                  icon="GoogleIllus"
                  title="Google"
                  onPress={handleGoogleLogin}
                  isLoading={
                    loggingInProvider === EOAuthSocialLoginProvider.Google
                  }
                />
              ) : null}
              {!requiredProvider ||
              requiredProvider === EOAuthSocialLoginProvider.Apple ? (
                <OptionItem
                  icon="AppleBrand"
                  title="Apple"
                  iconProps={{
                    color: '$iconActive',
                    y: -1,
                  }}
                  onPress={handleAppleLogin}
                  isLoading={
                    loggingInProvider === EOAuthSocialLoginProvider.Apple
                  }
                />
              ) : null}
            </YStack>
            <KeylessOnboardingDebugPanel
              isResetMode={isResetMode}
              onResetModeChange={setIsResetMode}
            />
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        {isVerifyMode ? null : (
          <OnboardingLayout.Footer>
            <Anchor
              href="https://help.onekey.so/articles/13348049"
              target="_blank"
              size="$bodySm"
              color="$textSubdued"
              textAlign="center"
            >
              {intl.formatMessage({
                id: ETranslations.keyless_wallet_help_center_link_label,
              })}
            </Anchor>
          </OnboardingLayout.Footer>
        )}
      </OnboardingLayout>
    </Page>
  );
}

function OneKeyIDLoginPageWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <OneKeyIDLoginPage />
    </AccountSelectorProviderMirror>
  );
}

export { OneKeyIDLoginPageWithContext as default };
