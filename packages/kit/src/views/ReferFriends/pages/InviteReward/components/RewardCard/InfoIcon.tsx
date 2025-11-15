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
  tooltip?: string;
}

export function InfoIcon({ onPress, size = '$5', tooltip }: IInfoIconProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const icon = <Icon name="InfoCircleOutline" size={size} onPress={onPress} />;

  if (tooltip) {
    // Use Popover on small screens (mobile/tablet), Tooltip on large screens (desktop)
    if (!gtMd) {
      return (
        <Popover
          placement="top"
          title={intl.formatMessage({ id: ETranslations.global_info })}
          renderTrigger={icon}
          renderContent={
            <YStack px="$5" py="$4">
              <SizableText size="$bodyMd">{tooltip}</SizableText>
            </YStack>
          }
        />
      );
    }

    return <Tooltip renderTrigger={icon} renderContent={tooltip} />;
  }

  return icon;
}
