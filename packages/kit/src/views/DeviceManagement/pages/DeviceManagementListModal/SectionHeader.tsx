import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

function SectionHeader() {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  const onAddDevice = useCallback(async () => {
    appNavigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
  }, [appNavigation]);

  return (
    <XStack ai="center" jc="space-between" gap="$5">
      <YStack flex={1}>
        <SizableText size="$heading2xl" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_my_device,
          })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_my_device_dec,
          })}
        </SizableText>
      </YStack>
      <YStack ai="center" jc="center" gap="$2" onPress={onAddDevice}>
        <IconButton
          icon="PlusLargeOutline"
          size="small"
          onPress={onAddDevice}
          title={intl.formatMessage({
            id: ETranslations.global_add,
          })}
        />
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_add,
          })}
        </SizableText>
      </YStack>
    </XStack>
  );
}

export default SectionHeader;
