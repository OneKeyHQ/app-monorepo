import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useNavigateToPickYourDevicePage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function SectionHeader() {
  const intl = useIntl();
  const toOnBoardingPage = useNavigateToPickYourDevicePage();
  const { gtMd } = useMedia();

  const onAddDevice = useCallback(async () => {
    void toOnBoardingPage();
  }, [toOnBoardingPage]);

  if (!gtMd) {
    return null;
  }

  return (
    <XStack ai="center" jc="space-between" gap="$5">
      <YStack flex={1} gap="$1">
        <SizableText size="$heading2xl" color="$text">
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
      <IconButton
        icon="PlusLargeOutline"
        size="small"
        variant="primary"
        onPress={onAddDevice}
      />
    </XStack>
  );
}

export default SectionHeader;
