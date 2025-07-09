import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IWatchlistToggleButtonProps {
  isActive: boolean;
  onToggle: () => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export function WatchlistToggleButton({
  isActive,
  onToggle,
  disabled = false,
}: IWatchlistToggleButtonProps) {
  const intl = useIntl();

  return (
    <Button
      variant="tertiary"
      onPress={onToggle}
      bg={isActive ? '$bgHover' : '$transparent'}
      disabled={disabled}
    >
      <XStack alignItems="center" gap="$2">
        <Icon
          name="StarOutline"
          size="$4.5"
          color={isActive ? '$icon' : '$iconSubdued'}
        />
        <SizableText
          size="$bodyMdMedium"
          color={isActive ? '$text' : '$textSubdued'}
        >
          {intl.formatMessage({
            id: ETranslations.global_watchlist,
            defaultMessage: 'Watchlist',
          })}
        </SizableText>
      </XStack>
    </Button>
  );
}
