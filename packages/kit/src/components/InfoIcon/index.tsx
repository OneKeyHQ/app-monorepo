import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SizableText,
  Stack,
  Tooltip,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IIconProps, IStackProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export interface IInfoIconProps {
  onPress?: () => void;
  size?: string;
  color?: IIconProps['color'];
  triggerPadding?: IStackProps['padding'];
  tooltip?: string | { title?: string; content: string };
}

export function InfoIcon({
  onPress,
  size = '$5',
  color,
  triggerPadding,
  tooltip,
}: IInfoIconProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const icon = (
    <Icon
      name="InfoCircleOutline"
      size={size}
      color={color}
      onPress={onPress}
    />
  );
  const trigger = triggerPadding ? (
    <Stack p={triggerPadding} onPress={onPress}>
      {icon}
    </Stack>
  ) : (
    icon
  );

  if (tooltip) {
    const tooltipContent =
      typeof tooltip === 'string' ? tooltip : tooltip.content;
    const tooltipTitle =
      typeof tooltip === 'object' && tooltip.title
        ? tooltip.title
        : intl.formatMessage({ id: ETranslations.global_info });

    // Native Tooltip returns only its trigger, so wide tablets still open Popover.
    if (!gtMd || platformEnv.isNative) {
      return (
        <Popover
          placement="top"
          title={tooltipTitle}
          renderTrigger={trigger}
          renderContent={
            <YStack px="$5" py="$4">
              <SizableText size="$bodyMd">{tooltipContent}</SizableText>
            </YStack>
          }
        />
      );
    }

    return <Tooltip renderTrigger={trigger} renderContent={tooltipContent} />;
  }

  return trigger;
}
