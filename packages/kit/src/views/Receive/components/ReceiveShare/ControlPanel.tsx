import { useIntl } from 'react-intl';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReceiveTestIDs } from '../../testIDs';

// TODO(i18n): no suitable existing key for the "More" action label
const moreActionLabel = 'More';

interface IControlPanelProps {
  onSaveImage: () => void;
  onShareImage: () => void;
  isLoading?: boolean;
  isMobile?: boolean;
}

export function ControlPanel({
  onSaveImage,
  onShareImage,
  isLoading,
  isMobile,
}: IControlPanelProps) {
  const intl = useIntl();

  return (
    <XStack
      gap="$6"
      mb={isMobile ? '$4' : undefined}
      alignItems="center"
      justifyContent="center"
    >
      <YStack gap="$1" alignItems="center">
        <IconButton
          testID={ReceiveTestIDs.ShareSaveButton}
          title={intl.formatMessage({
            id: ETranslations.action_save,
          })}
          cursor="pointer"
          icon="DownloadOutline"
          size="large"
          onPress={onSaveImage}
          disabled={isLoading}
          iconSize="$6"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$borderSubdued"
          hoverStyle={{ borderColor: '$borderHover' }}
          bg="$bgApp"
        />
        <SizableText size="$bodySm" color="$text">
          {intl.formatMessage({
            id: ETranslations.action_save,
          })}
        </SizableText>
      </YStack>

      <YStack gap="$1" alignItems="center">
        <IconButton
          testID={ReceiveTestIDs.ShareMoreButton}
          title={moreActionLabel}
          cursor="pointer"
          icon="ShareOutline"
          size="large"
          onPress={onShareImage}
          disabled={isLoading}
          iconSize="$6"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$borderSubdued"
          hoverStyle={{ borderColor: '$borderHover' }}
          bg="$bgApp"
        />
        <SizableText size="$bodySm" color="$text">
          {moreActionLabel}
        </SizableText>
      </YStack>
    </XStack>
  );
}
