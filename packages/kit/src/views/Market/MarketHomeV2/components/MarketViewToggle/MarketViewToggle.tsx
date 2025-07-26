import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import { useShowWatchlistOnlyValue } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useShowWatchlistOnlyActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/actions';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IMarketViewToggleProps {
  disabled?: boolean;
}

export interface IToggleButtonProps {
  isActive: boolean;
  onPress: (() => void) | undefined;
  disabled: boolean;
  translationId: ETranslations;
  defaultMessage: string;
}

export function ToggleButton({
  isActive,
  onPress,
  disabled,
  translationId,
  defaultMessage,
}: IToggleButtonProps) {
  const intl = useIntl();

  return (
    <Button
      variant="tertiary"
      onPress={onPress}
      bg={isActive ? '$bgHover' : '$transparent'}
      disabled={disabled}
    >
      <SizableText
        size="$bodyLgMedium"
        color={isActive ? '$text' : '$textSubdued'}
      >
        {intl.formatMessage({
          id: translationId,
          defaultMessage,
        })}
      </SizableText>
    </Button>
  );
}

export function MarketViewToggle({ disabled = false }: IMarketViewToggleProps) {
  const [showWatchlistOnly] = useShowWatchlistOnlyValue();
  const { current: showWatchlistOnlyActions } = useShowWatchlistOnlyActions();

  const onToggle = () => {
    showWatchlistOnlyActions.toggleShowWatchlistOnly();
  };
  return (
    <XStack gap="$6">
      <ToggleButton
        isActive={showWatchlistOnly}
        onPress={!showWatchlistOnly ? onToggle : undefined}
        disabled={disabled}
        translationId={ETranslations.global_watchlist}
        defaultMessage="Watchlist"
      />
      <ToggleButton
        isActive={!showWatchlistOnly}
        onPress={showWatchlistOnly ? onToggle : undefined}
        disabled={disabled}
        translationId={ETranslations.market_trending}
        defaultMessage="Trending"
      />
    </XStack>
  );
}
