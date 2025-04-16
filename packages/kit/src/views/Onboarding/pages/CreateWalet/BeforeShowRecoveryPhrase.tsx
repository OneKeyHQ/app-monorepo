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
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';
import { useCallback } from 'react';

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
  const handleShowRecoveryPhrasePress = async () => {
    const mnemonic = route.params?.mnemonic;
    if (mnemonic) ensureSensitiveTextEncoded(mnemonic);

    navigation.push(EOnboardingPages.RecoveryPhrase, {
      mnemonic,
      isBackup: route.params?.isBackup,
    });
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'CreateWallet',
      isSoftwareWalletOnlyUser,
    });
  };

  const handleSkipRecoveryPhrasePress = useCallback(() => {}, [navigation]);

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
      <Page.Body>
        <YStack
          gap="$3"
          pb="$5"
          pt="$2"
          justifyContent="center"
          alignItems="center"
          mt="$16"
        >
          <Icon name="SecretPhraseOutline" color="$iconSubdued" size="$12" />
          <SizableText
            size="$headingLg"
            $gtMd={{ width: 288 }}
            textAlign="center"
          >
            {intl.formatMessage({
              id: ETranslations.onboarding_save_phrase_securely_instruction,
            })}
          </SizableText>
        </YStack>
        <Stack alignItems="center">
          <Stack $gtMd={{ width: 400 }}>
            {messages.map((item) => (
              <ListItem gap="$3" key={item.message} alignItems="flex-start">
                <Stack
                  width="$5"
                  height="$5"
                  justifyContent="center"
                  alignItems="center"
                  mt="$1"
                >
                  <Icon size="$5" name={item.icon} color="$iconSubdued" />
                </Stack>
                <ListItem.Text
                  flex={1}
                  primary={item.message}
                  primaryTextProps={{
                    size: '$bodyLg',
                  }}
                />
              </ListItem>
            ))}
          </Stack>
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
            $md: {
              flexGrow: 1,
            },
          }}
          cancelButtonProps={{
            onPress: handleSkipRecoveryPhrasePress,
            testID: 'skip-recovery-phrase',
            $md: {
              flexGrow: 1,
            },
          }}
          onCancelText={intl.formatMessage({
            id: ETranslations.global_skip_for_now,
          })}
          buttonContainerProps={{
            w: media.gtMd ? '100%' : 'auto',
            flexDirection: media.gtMd ? 'row' : 'column-reverse',
            justifyContent: media.gtMd ? 'space-between' : undefined,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default BeforeShowRecoveryPhrase;
