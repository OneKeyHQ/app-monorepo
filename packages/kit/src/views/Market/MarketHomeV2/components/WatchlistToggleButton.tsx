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
  size = 'small',
  disabled = false,
}: IWatchlistToggleButtonProps) {
  const intl = useIntl();

  return (
    <Button
      size={size}
      variant="tertiary"
      onPress={onToggle}
      disabled={disabled}
    >
      <XStack alignItems="center" gap="$2">
        <Icon
          name={isActive ? 'StarSolid' : 'StarOutline'}
          size="$4"
          color={isActive ? '$iconActive' : '$iconDisabled'}
        />
        <SizableText
          size="$bodyMd"
          color={isActive ? '$textOnPrimary' : '$textSubdued'}
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
