import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Divider,
  Group,
  Heading,
  Image,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';

import type { IDeviceType } from '@onekeyfe/hd-core';

type IStep = {
  title?: ETranslations;
  description?: ETranslations;
  type: IDeviceType;
};

export function ActivateDevice({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.ActivateDevice>) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { tutorialType, deviceType } = route.params;

  const handleConfirmPress = () => {
    navigation.pop();
  };

  const getCreateNewWalletStep = (type: IStep['type']) => {
    const images = {
      unknown: require('@onekeyhq/kit/assets/onboarding/classic-create-new-wallet.png'),
      classic: require('@onekeyhq/kit/assets/onboarding/classic-create-new-wallet.png'),
      classic1s: require('@onekeyhq/kit/assets/onboarding/classic-create-new-wallet.png'),
      mini: require('@onekeyhq/kit/assets/onboarding/mini-create-new-wallet.png'),
      touch: require('@onekeyhq/kit/assets/onboarding/touch-create-new-wallet.png'),
      pro: require('@onekeyhq/kit/assets/onboarding/touch-create-new-wallet.png'),
    };

    return {
      title: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_create_new_wallet,
      }),
      description: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_create_new_wallet_desc,
      }),
      uri: images[type],
    };
  };

  const getWriteDownRecoveryPhraseStep = (type: IStep['type']) => {
    const images = {
      unknown: require('@onekeyhq/kit/assets/onboarding/classic-write-down-recovery-phrase.png'),
      classic: require('@onekeyhq/kit/assets/onboarding/classic-write-down-recovery-phrase.png'),
      classic1s: require('@onekeyhq/kit/assets/onboarding/classic-write-down-recovery-phrase.png'),
      mini: require('@onekeyhq/kit/assets/onboarding/mini-write-down-recovery-phrase.png'),
      touch: require('@onekeyhq/kit/assets/onboarding/touch-write-down-recovery-phrase.png'),
      pro: require('@onekeyhq/kit/assets/onboarding/touch-write-down-recovery-phrase.png'),
    };

    return {
      title: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_backup,
      }),
      description: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_backup_desc,
      }),
      uri: images[type],
    };
  };

  const getSetPinStep = (type: IStep['type']) => {
    const images = {
      unknown: require('@onekeyhq/kit/assets/onboarding/classic-set-pin.png'),
      classic: require('@onekeyhq/kit/assets/onboarding/classic-set-pin.png'),
      classic1s: require('@onekeyhq/kit/assets/onboarding/classic-set-pin.png'),
      mini: require('@onekeyhq/kit/assets/onboarding/mini-set-pin.png'),
      touch: require('@onekeyhq/kit/assets/onboarding/touch-set-pin.png'),
      pro: require('@onekeyhq/kit/assets/onboarding/touch-set-pin.png'),
    };

    return {
      title: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_pin,
      }),
      description: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_pin_desc,
      }),
      uri: images[type],
    };
  };

  const getImportWalletStep = (type: IStep['type']) => {
    const images = {
      unknown: require('@onekeyhq/kit/assets/onboarding/classic-import-wallet.png'),
      classic: require('@onekeyhq/kit/assets/onboarding/classic-import-wallet.png'),
      classic1s: require('@onekeyhq/kit/assets/onboarding/classic-import-wallet.png'),
      mini: require('@onekeyhq/kit/assets/onboarding/mini-import-wallet.png'),
      touch: require('@onekeyhq/kit/assets/onboarding/touch-create-new-wallet.png'),
      pro: require('@onekeyhq/kit/assets/onboarding/touch-create-new-wallet.png'),
    };

    return {
      title:
        type === 'mini'
          ? intl.formatMessage({
              id: ETranslations.onboarding_device_mini_set_up_import,
            })
          : intl.formatMessage({
              id: ETranslations.onboarding_device_set_up_import,
            }),
      description: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_import_desc,
      }),
      uri: images[type],
    };
  };

  const getEnterRecoveryPhraseStep = (type: IStep['type']) => {
    const images = {
      unknown: require('@onekeyhq/kit/assets/onboarding/classic-enter-recovery-phrase.png'),
      classic: require('@onekeyhq/kit/assets/onboarding/classic-enter-recovery-phrase.png'),
      classic1s: require('@onekeyhq/kit/assets/onboarding/classic-enter-recovery-phrase.png'),
      mini: require('@onekeyhq/kit/assets/onboarding/mini-enter-recovery-phrase.png'),
      touch: require('@onekeyhq/kit/assets/onboarding/touch-enter-recovery-phrase.png'),
      pro: require('@onekeyhq/kit/assets/onboarding/touch-enter-recovery-phrase.png'),
    };

    return {
      title: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_enter_recovery_phrase,
      }),
      description: intl.formatMessage({
        id: ETranslations.onboarding_device_set_up_enter_recovery_phrase_desc,
      }),
      uri: images[type],
    };
  };

  const deviceSteps = {
    classic: {
      create: [
        getCreateNewWalletStep('classic'),
        getWriteDownRecoveryPhraseStep('classic'),
        getSetPinStep('classic'),
      ],
      restore: [
        getImportWalletStep('classic'),
        getEnterRecoveryPhraseStep('classic'),
        getSetPinStep('classic'),
      ],
    },
    mini: {
      create: [
        getCreateNewWalletStep('mini'),
        getWriteDownRecoveryPhraseStep('mini'),
        getSetPinStep('mini'),
      ],
      restore: [
        getImportWalletStep('mini'),
        getEnterRecoveryPhraseStep('mini'),
        getSetPinStep('mini'),
      ],
    },
    touch: {
      create: [
        getCreateNewWalletStep('touch'),
        getWriteDownRecoveryPhraseStep('touch'),
        getSetPinStep('touch'),
      ],
      restore: [
        getImportWalletStep('touch'),
        getEnterRecoveryPhraseStep('touch'),
        getSetPinStep('touch'),
      ],
    },
    pro: {
      create: [
        getCreateNewWalletStep('pro'),
        getWriteDownRecoveryPhraseStep('pro'),
        getSetPinStep('pro'),
      ],
      restore: [
        getImportWalletStep('pro'),
        getEnterRecoveryPhraseStep('pro'),
        getSetPinStep('pro'),
      ],
    },
  };

  const steps = deviceSteps[deviceType][tutorialType];

  return (
    <Page scrollEnabled>
      <Page.Header
        title={
          tutorialType === 'create'
            ? intl.formatMessage({
                id: ETranslations.onboarding_activate_device_by_set_up_new_wallet,
              })
            : intl.formatMessage({
                id: ETranslations.onboarding_activate_device_by_restore,
              })
        }
      />
      <Page.Body px="$5">
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.onboarding_activate_device_choosing_language_message,
          })}
        </SizableText>
        <Group separator={<Divider />}>
          {steps.map(({ title, description, uri }, index) => (
            <Group.Item key={title}>
              <Stack
                $gtMd={{
                  flexDirection: 'row',
                }}
                py="$5"
              >
                <Stack
                  h="$64"
                  $gtMd={{
                    w: '$56',
                    h: '$56',
                  }}
                  bg="$bgSubdued"
                  borderRadius="$3"
                  borderCurve="continuous"
                >
                  <Image
                    width="100%"
                    height="$64"
                    $gtMd={{
                      w: '$56',
                      h: '$56',
                    }}
                    resizeMode="contain"
                    source={uri}
                  />
                  <SizableText
                    size="$bodySmMedium"
                    position="absolute"
                    top="$2.5"
                    left="$2.5"
                    borderRadius="$1"
                    minWidth="$5"
                    py="$0.5"
                    bg="$bgInfo"
                    color="$textInfo"
                    textAlign="center"
                  >
                    {index + 1}
                  </SizableText>
                </Stack>
                <Stack
                  flex={1}
                  pt="$5"
                  $gtMd={{
                    pt: 0,
                    pl: '$5',
                  }}
                >
                  <Heading size="$headingMd">{title}</Heading>
                  <SizableText color="$textSubdued" mt="$1">
                    {description}
                  </SizableText>
                </Stack>
              </Stack>
            </Group.Item>
          ))}
        </Group>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.onboarding_activate_device_all_set,
        })}
        onConfirm={handleConfirmPress}
      />
    </Page>
  );
}

export default ActivateDevice;
