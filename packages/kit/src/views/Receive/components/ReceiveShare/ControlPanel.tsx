import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
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

function ActionItem({
  testID,
  icon,
  label,
  onPress,
  disabled,
}: {
  testID?: string;
  icon: IKeyOfIcons;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <YStack gap="$1" alignItems="center" minWidth={56}>
      <Stack
        testID={testID}
        bg="$bgStrong"
        borderRadius="$full"
        p="$2"
        onPress={onPress}
        disabled={disabled}
        userSelect="none"
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        focusable
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineOffset: 2,
          outlineStyle: 'solid',
        }}
        opacity={disabled ? 0.5 : 1}
      >
        <Icon name={icon} size="$6" color="$icon" />
      </Stack>
      <SizableText size="$bodyMd" color="$text">
        {label}
      </SizableText>
    </YStack>
  );
}

export function ControlPanel({
  onSaveImage,
  onShareImage,
  isLoading,
  isMobile,
}: IControlPanelProps) {
  const intl = useIntl();

  return (
    <XStack gap="$5" mb={isMobile ? '$4' : undefined} alignItems="flex-start">
      <ActionItem
        testID={ReceiveTestIDs.ShareSaveButton}
        icon="DownloadOutline"
        label={intl.formatMessage({ id: ETranslations.action_save })}
        onPress={onSaveImage}
        disabled={isLoading}
      />
      <ActionItem
        testID={ReceiveTestIDs.ShareMoreButton}
        icon="ShareOutline"
        label={moreActionLabel}
        onPress={onShareImage}
        disabled={isLoading}
      />
    </XStack>
  );
}
