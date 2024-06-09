import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { ColorTokens, IIconProps } from '@onekeyhq/components';
import { Icon, Page, SizableText, Stack } from '@onekeyhq/components';
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

interface IWaningMessage {
  icon?: IIconProps['name'];
  iconColor?: IIconProps['color'];
  iconContainerColor?: ColorTokens;
  message?: string;
}

export function BeforeShowRecoveryPhrase() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const route =
    useRoute<
      RouteProp<IOnboardingParamList, EOnboardingPages.BeforeShowRecoveryPhrase>
    >();

  const handleShowRecoveryPhrasePress = () => {
    const mnemonic = route.params?.mnemonic;
    if (mnemonic) ensureSensitiveTextEncoded(mnemonic);

    navigation.push(EOnboardingPages.RecoveryPhrase, {
      mnemonic,
      isBackup: route.params?.isBackup,
    });
  };

  const messages: IWaningMessage[] = [
    {
      icon: 'LockOutline',
      iconColor: '$iconInfo',
      iconContainerColor: '$bgInfo',
      message: intl.formatMessage({
        id: ETranslations.onboarding_bullet_recovery_phrase_full_access,
      }),
    },
    {
      icon: 'InputOutline',
      iconColor: '$iconSuccess',
      iconContainerColor: '$bgSuccess',
      message: intl.formatMessage({
        id: ETranslations.onboarding_bullet_forgot_password_use_recovery,
      }),
    },
    {
      icon: 'EyeOffOutline',
      iconColor: '$iconCritical',
      iconContainerColor: '$bgCritical',
      message: intl.formatMessage({
        id: ETranslations.onboarding_bullet_never_share_recovery_phrase,
      }),
    },
    {
      icon: 'ShieldCheckDoneOutline',
      iconColor: '$iconCaution',
      iconContainerColor: '$bgCaution',
      message: intl.formatMessage({
        id: ETranslations.onboarding_bullet_onekey_support_no_recovery_phrase,
      }),
    },
  ];

  return (
    <Page safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.onboarding_before_reveal_message,
        })}
      />
      <Page.Body>
        <SizableText
          pt="$2"
          pb="$4"
          px="$6"
          size="$bodyLg"
          color="$textSubdued"
        >
          {intl.formatMessage({
            id: ETranslations.onboarding_save_phrase_securely_instruction,
          })}
        </SizableText>
        {messages.map((item) => (
          <ListItem space="$5" key={item.message}>
            <Stack
              p="$2"
              borderRadius="$3"
              bg={item.iconContainerColor}
              borderCurve="continuous"
            >
              <Icon name={item.icon} color={item.iconColor} />
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
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_show_recovery_phrase,
        })}
        onConfirm={handleShowRecoveryPhrasePress}
        confirmButtonProps={{ testID: 'show-recovery-phrase' }}
      />
    </Page>
  );
}

export default BeforeShowRecoveryPhrase;
