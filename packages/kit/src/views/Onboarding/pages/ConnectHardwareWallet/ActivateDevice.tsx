import { useEffect, useState } from 'react';

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
      case 'unknown':
        return;
      case 'classic':
      case 'classic1s':
        switch (stepType) {
          case 'create':
            return [
              getCreateNewWalletStep('classic'),
              getWriteDownRecoveryPhraseStep('classic'),
              getSetPinStep('classic'),
            ];
          case 'restore':
            return [
              getImportWalletStep('classic'),
              getEnterRecoveryPhraseStep('classic'),
              getSetPinStep('classic'),
            ];
          default:
            // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
            const _exhaustiveCheck: never = stepType;
        }
        return;
      case 'mini':
        if (stepType === 'create') {
          return [
            getCreateNewWalletStep('mini'),
            getWriteDownRecoveryPhraseStep('mini'),
            getSetPinStep('mini'),
          ];
        }
        if (stepType === 'restore') {
          return [
            getImportWalletStep('mini'),
            getEnterRecoveryPhraseStep('mini'),
            getSetPinStep('mini'),
          ];
        }
        return;
      case 'touch':
        if (stepType === 'create') {
          return [
            getCreateNewWalletStep('touch'),
            getWriteDownRecoveryPhraseStep('touch'),
            getSetPinStep('touch'),
          ];
        }
        if (stepType === 'restore') {
          return [
            getImportWalletStep('touch'),
            getEnterRecoveryPhraseStep('touch'),
            getSetPinStep('touch'),
          ];
        }
        return;
      case 'pro':
        if (stepType === 'create') {
          return [
            getCreateNewWalletStep('pro'),
            getWriteDownRecoveryPhraseStep('pro'),
            getSetPinStep('pro'),
          ];
        }
        if (stepType === 'restore') {
          return [
            getImportWalletStep('pro'),
            getEnterRecoveryPhraseStep('pro'),
            getSetPinStep('pro'),
          ];
        }
        return;
      default:
        // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
        const _exhaustiveCheck: never = onekeyDeviceType;
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
