import type { ComponentProps } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Anchor,
  AnimatePresence,
  Icon,
  SizableText,
  Spinner,
  Toast,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
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
import { OnboardingPage } from '../components/Layout';

import { KeylessOnboardingDebugPanel } from './KeylessOnboardingDebugPanel';

const optionItemNativePressableStyle = {
  width: '100%',
  flexGrow: 0,
  flexShrink: 0,
} as const;

function OptionItem({
  icon,
  iconProps,
  title,
  isLoading,
  onPress,
  mt,
}: {
  icon: IKeyOfIcons;
  iconProps?: IIconProps;
  title: string;
  isLoading?: boolean;
  onPress?: () => void;
  mt?: ComponentProps<typeof ListItem>['mt'];
}) {
  return (
    <ListItem
      gap="$3"
      bg="$bg"
      w="100%"
      minHeight="$14"
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
      overflow="hidden"
      p="$3"
      m="$0"
      mt={mt}
      nativePressableStyle={optionItemNativePressableStyle}
      onPress={onPress}
      userSelect="none"
    >
      <YStack
        w="$10"
        h="$10"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        borderRadius="$full"
        bg="$neutral2"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$neutral2"
        p="$2"
      >
        <Icon name={icon} size="$5" {...iconProps} />
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
              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
              enterStyle={{ scale: 0.7, opacity: 0 }}
              exitStyle={{ scale: 0.7, opacity: 0 }}
            >
              <Spinner size="small" />
            </YStack>
          ) : (
            <YStack
              key="chevron-right"
              animation="quick"
              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
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
      // Close the same-tick re-entry window before React state updates commit.
      loggingInProviderRef.current = provider;
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
        loggingInProviderRef.current = null;
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

  const title = isVerifyMode
    ? intl.formatMessage({ id: ETranslations.keyless_verify_identity_title })
    : intl.formatMessage({ id: ETranslations.select_your_email });
  const desc = isVerifyMode
    ? intl.formatMessage(
        { id: ETranslations.keyless_verify_identity_desc },
        {
          provider:
            requiredProvider === EOAuthSocialLoginProvider.Apple
              ? 'Apple'
              : 'Google',
        },
      )
    : intl.formatMessage({ id: ETranslations.select_your_email_desc });

  return (
    <OnboardingPage
      scrollable={!platformEnv.isNative}
      narrow
      contentContainerProps={{ gap: '$10' }}
    >
      <YStack gap="$2">
        <SizableText size="$heading3xl">{title}</SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {desc}
        </SizableText>
      </YStack>
      <YStack gap="$3">
        {!requiredProvider ||
        requiredProvider === EOAuthSocialLoginProvider.Google ? (
          <OptionItem
            icon="GoogleIllus"
            title="Google"
            onPress={loggingInProvider ? undefined : handleGoogleLogin}
            isLoading={loggingInProvider === EOAuthSocialLoginProvider.Google}
          />
        ) : null}
        {!requiredProvider ||
        requiredProvider === EOAuthSocialLoginProvider.Apple ? (
          <OptionItem
            icon="AppleBrand"
            title="Apple"
            mt={!requiredProvider ? '$3' : undefined}
            iconProps={{
              color: '$iconActive',
              y: -1,
            }}
            onPress={loggingInProvider ? undefined : handleAppleLogin}
            isLoading={loggingInProvider === EOAuthSocialLoginProvider.Apple}
          />
        ) : null}
      </YStack>
      <KeylessOnboardingDebugPanel
        isResetMode={isResetMode}
        onResetModeChange={setIsResetMode}
      />
      {isVerifyMode ? null : (
        <YStack mt="auto" pt="$8" alignItems="center">
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
        </YStack>
      )}
    </OnboardingPage>
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
