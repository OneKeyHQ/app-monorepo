import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SizableText,
  Tooltip,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ICommunityRecognizedBadgeProps {
  size?: '$4' | '$5';
}

export function CommunityRecognizedBadge({
  size = '$4',
}: ICommunityRecognizedBadgeProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();

  const iconElement = (
    <Icon name="BadgeRecognizedSolid" size={size} color="$iconSuccess" />
  );

  const contentText = intl.formatMessage({
    id: ETranslations.dexmarket_communityRecognized,
  });

  // Use Popover on small screens (mobile/tablet), Tooltip on large screens (desktop)
  if (!gtMd) {
    return (
      <Popover
        title={
          <Icon name="BadgeRecognizedSolid" size="$8" color="$iconSuccess" />
        }
        placement="top"
        renderTrigger={iconElement}
        renderContent={
          <YStack px="$5" py="$4">
            <SizableText size="$bodyLgMedium">{contentText}</SizableText>
          </YStack>
        }
      />
    );
  }

  return (
    <Tooltip
      placement="top"
      renderTrigger={iconElement}
      renderContent={<SizableText size="$bodySm">{contentText}</SizableText>}
    />
  );
}
