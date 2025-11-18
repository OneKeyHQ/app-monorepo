import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SizableText,
  Tooltip,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

export interface IInfoIconProps {
  onPress?: () => void;
  size?: string;
  tooltip?: string | { title?: string; content: string };
}

export function InfoIcon({ onPress, size = '$5', tooltip }: IInfoIconProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const icon = <Icon name="InfoCircleOutline" size={size} onPress={onPress} />;

  if (tooltip) {
    const tooltipContent =
      typeof tooltip === 'string' ? tooltip : tooltip.content;
    const tooltipTitle =
      typeof tooltip === 'object' && tooltip.title
        ? tooltip.title
        : intl.formatMessage({ id: ETranslations.global_info });

    // Use Popover on small screens (mobile/tablet), Tooltip on large screens (desktop)
    if (!gtMd) {
      return (
        <Popover
          placement="top"
          title={tooltipTitle}
          renderTrigger={icon}
          renderContent={
            <YStack px="$5" py="$4">
              <SizableText size="$bodyMd">{tooltipContent}</SizableText>
            </YStack>
          }
        />
      );
    }

    return <Tooltip renderTrigger={icon} renderContent={tooltipContent} />;
  }

  return icon;
}
