import { EDeviceType } from '@onekeyfe/hd-shared';
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

import {
  getCreateNewWalletStepImage,
  getEnterRecoveryPhraseStepImage,
  getImportWalletStepImage,
  getSetPinStepImage,
  getWriteDownRecoveryPhraseStepImage,
} from './ActivateDeviceResource';

import type { IDeviceType } from '@onekeyfe/hd-core';

type IStep = {
  title?: ETranslations;
  description?: ETranslations;
  type: IDeviceType;
  uri: any;
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

  const getCreateNewWalletStep = (type: IStep['type']) => ({
    title: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_create_new_wallet,
    }),
    description: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_create_new_wallet_desc,
    }),
    uri: getCreateNewWalletStepImage(type),
  });

  const getWriteDownRecoveryPhraseStep = (type: IStep['type']) => ({
    title: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_backup,
    }),
    description: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_backup_desc,
    }),
    uri: getWriteDownRecoveryPhraseStepImage(type),
  });

  const getSetPinStep = (type: IStep['type']) => ({
    title: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_pin,
    }),
    description: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_pin_desc,
    }),
    uri: getSetPinStepImage(type),
  });

  const getImportWalletStep = (type: IStep['type']) => ({
    title:
      type === EDeviceType.Mini
        ? intl.formatMessage({
            id: ETranslations.onboarding_device_mini_set_up_import,
          })
        : intl.formatMessage({
            id: ETranslations.onboarding_device_set_up_import,
          }),
    description: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_import_desc,
    }),
    uri: getImportWalletStepImage(type),
  });

  const getEnterRecoveryPhraseStep = (type: IStep['type']) => ({
    title: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_enter_recovery_phrase,
    }),
    description: intl.formatMessage({
      id: ETranslations.onboarding_device_set_up_enter_recovery_phrase_desc,
    }),
    uri: getEnterRecoveryPhraseStepImage(type),
  });

  type IDeviceStepType = 'create' | 'restore';
  type IDeviceStepDetail = {
    title: string;
    description: string;
    uri: any | undefined;
  };

  const getDeviceSteps = (
    onekeyDeviceType: IDeviceType,
    stepType: IDeviceStepType,
  ): IDeviceStepDetail[] | undefined => {
    switch (onekeyDeviceType) {
      case EDeviceType.Unknown:
        return;
      case EDeviceType.Classic:
      case EDeviceType.Classic1s:
      case EDeviceType.ClassicPure:
        switch (stepType) {
          case 'create':
            return [
              getCreateNewWalletStep(EDeviceType.Classic),
              getWriteDownRecoveryPhraseStep(EDeviceType.Classic),
              getSetPinStep(EDeviceType.Classic),
            ];
          case 'restore':
            return [
              getImportWalletStep(EDeviceType.Classic),
              getEnterRecoveryPhraseStep(EDeviceType.Classic),
              getSetPinStep(EDeviceType.Classic),
            ];
          default:
            // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
            const _exhaustiveCheck: never = stepType;
        }
        return;
      case EDeviceType.Mini:
        if (stepType === 'create') {
          return [
            getCreateNewWalletStep(EDeviceType.Mini),
            getWriteDownRecoveryPhraseStep(EDeviceType.Mini),
            getSetPinStep(EDeviceType.Mini),
          ];
        }
        if (stepType === 'restore') {
          return [
            getImportWalletStep(EDeviceType.Mini),
            getEnterRecoveryPhraseStep(EDeviceType.Mini),
            getSetPinStep(EDeviceType.Mini),
          ];
        }
        return;
      case EDeviceType.Touch:
        if (stepType === 'create') {
          return [
            getCreateNewWalletStep(EDeviceType.Touch),
            getWriteDownRecoveryPhraseStep(EDeviceType.Touch),
            getSetPinStep(EDeviceType.Touch),
          ];
        }
        if (stepType === 'restore') {
          return [
            getImportWalletStep(EDeviceType.Touch),
            getEnterRecoveryPhraseStep(EDeviceType.Touch),
            getSetPinStep(EDeviceType.Touch),
          ];
        }
        return;
      case EDeviceType.Pro:
        if (stepType === 'create') {
          return [
            getCreateNewWalletStep(EDeviceType.Pro),
            getWriteDownRecoveryPhraseStep(EDeviceType.Pro),
            getSetPinStep(EDeviceType.Pro),
          ];
        }
        if (stepType === 'restore') {
          return [
            getImportWalletStep(EDeviceType.Pro),
            getEnterRecoveryPhraseStep(EDeviceType.Pro),
            getSetPinStep(EDeviceType.Pro),
          ];
        }
        return;
      default:
        // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
        const _exhaustiveCheck = onekeyDeviceType;
    }
  };

  const steps = getDeviceSteps(deviceType, tutorialType);

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
          {steps?.map(({ title, description, uri }, index) => (
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
