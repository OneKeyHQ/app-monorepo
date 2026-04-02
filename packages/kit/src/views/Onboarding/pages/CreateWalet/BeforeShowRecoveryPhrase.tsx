import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IIconProps } from '@onekeyhq/components';
import {
  Icon,
  Page,
  SizableText,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  ensureSensitiveTextEncoded,
  generateMnemonic,
} from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

interface IWaningMessage {
  icon?: IIconProps['name'];
  message?: string;
}

export function BeforeShowRecoveryPhrase() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const media = useMedia();

  const route =
    useRoute<
      RouteProp<IOnboardingParamList, EOnboardingPages.BeforeShowRecoveryPhrase>
    >();

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const [settings] = useSettingsPersistAtom();

  const handleShowRecoveryPhrasePress = async () => {
    const mnemonic = route.params?.mnemonic;
    if (mnemonic) ensureSensitiveTextEncoded(mnemonic);

    navigation.push(EOnboardingPages.RecoveryPhrase, {
      mnemonic,
      isBackup: route.params?.isBackup,
      isWalletBackedUp: route.params?.isWalletBackedUp,
      walletId: route.params?.walletId,
    });
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'CreateWallet',
      details: {
        isBiometricSet: settings.isBiologyAuthSwitchOn,
        unbackedUp: false,
      },
      isSoftwareWalletOnlyUser,
    });
  };

  const handleSkipRecoveryPhrasePress = useCallback(async () => {
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'CreateWallet',
      details: {
        isBiometricSet: settings.isBiologyAuthSwitchOn,
        unbackedUp: true,
      },
      isSoftwareWalletOnlyUser,
    });

    let mnemonic = route.params?.mnemonic;
    if (mnemonic) {
      ensureSensitiveTextEncoded(mnemonic);
      mnemonic = await backgroundApiProxy.servicePassword.decodeSensitiveText({
        encodedText: mnemonic,
      });
    } else {
      mnemonic = generateMnemonic();
    }

    defaultLogger.account.wallet.walletAdded({
      status: 'success',
      addMethod: 'CreateWallet',
      details: {
        isBiometricSet: settings.isBiologyAuthSwitchOn,
        unbackedUp: true,
      },
      isSoftwareWalletOnlyUser,
    });

    navigation.push(EOnboardingPages.FinalizeWalletSetup, {
      mnemonic: await backgroundApiProxy.servicePassword.encodeSensitiveText({
        text: mnemonic,
      }),
      isWalletBackedUp: false,
    });
  }, [
    route.params?.mnemonic,
    settings.isBiologyAuthSwitchOn,
    isSoftwareWalletOnlyUser,
    navigation,
  ]);

  const messages: IWaningMessage[] = [
    {
      icon: 'LockOutline',
      message: intl.formatMessage({
        id: ETranslations.onboarding_bullet_recovery_phrase_full_access,
      }),
    },
    {
      icon: 'InputOutline',
      message: intl.formatMessage({
        id: ETranslations.onboarding_bullet_forgot_passcode_use_recovery,
      }),
    },
    {
      icon: 'EyeOffOutline',
      message: intl.formatMessage({
        id: ETranslations.onboarding_bullet_never_share_recovery_phrase,
      }),
    },
    {
      icon: 'ShieldCheckDoneOutline',
      message: intl.formatMessage({
        id: ETranslations.onboarding_bullet_onekey_support_no_recovery_phrase,
      }),
    },
  ];

  return (
    <Page safeAreaEnabled>
      <Page.Header />
      <Page.Body alignItems="center" justifyContent="center">
        <YStack gap="$3" pb="$5" pt="$2" alignItems="center">
          <Icon name="SecretPhraseOutline" color="$iconSubdued" size="$12" />
          <SizableText size="$headingLg" maxWidth="$72" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.onboarding_save_phrase_securely_instruction,
            })}
          </SizableText>
        </YStack>
        <Stack
          w="100%"
          $gtMd={{
            maxWidth: '$80',
          }}
        >
          {messages.map((item) => (
            <ListItem
              gap="$3"
              py="$3"
              key={item.message}
              alignItems="flex-start"
            >
              <Stack
                justifyContent="center"
                alignItems="center"
                py={3}
                $gtMd={{
                  py: '$px',
                }}
              >
                <Icon size="$5" name={item.icon} color="$iconSubdued" />
              </Stack>
              <SizableText
                flex={1}
                lineHeight={26}
                $gtMd={{
                  size: '$bodyMd',
                  lineHeight: 22,
                }}
              >
                {item.message}
              </SizableText>
            </ListItem>
          ))}
        </Stack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_show_recovery_phrase,
          })}
          confirmButtonProps={{
            onPress: handleShowRecoveryPhrasePress,
            testID: 'show-recovery-phrase',
            size: media.gtMd ? 'medium' : 'large',
            $md: {
              flexGrow: 1,
            },
          }}
          cancelButtonProps={
            route.params?.isBackup
              ? undefined
              : {
                  onPress: handleSkipRecoveryPhrasePress,
                  testID: 'skip-recovery-phrase',
                  size: media.gtMd ? 'medium' : 'large',
                  $md: {
                    flexGrow: 1,
                  },
                }
          }
          onCancelText={
            route.params?.isBackup
              ? undefined
              : intl.formatMessage({
                  id: ETranslations.global_skip_for_now,
                })
          }
          buttonContainerProps={{
            w: media.gtMd ? '100%' : 'auto',
            flexDirection: media.gtMd ? 'row' : 'column-reverse',
            // eslint-disable-next-line no-nested-ternary
            justifyContent: media.gtMd
              ? route.params?.isBackup
                ? 'flex-end'
                : 'space-between'
              : undefined,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default BeforeShowRecoveryPhrase;
