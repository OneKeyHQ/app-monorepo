import { useIntl } from 'react-intl';

import {
  Button,
  type IIconProps,
  Icon,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { useShowWatchlistOnlyValue } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useShowWatchlistOnlyActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/actions';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IMarketViewToggleProps {
  disabled?: boolean;
}

interface IToggleButtonProps {
  isActive: boolean;
  onPress: (() => void) | undefined;
  disabled: boolean;
  iconName: IIconProps['name'];
  translationId: ETranslations;
  defaultMessage: string;
}

function ToggleButton({
  isActive,
  onPress,
  disabled,
  iconName,
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
      <XStack alignItems="center" gap="$2">
        <Icon
          name={iconName}
          size="$4.5"
          color={isActive ? '$icon' : '$iconSubdued'}
        />
        <SizableText
          size="$bodyMdMedium"
          color={isActive ? '$text' : '$textSubdued'}
        >
          {intl.formatMessage({
            id: translationId,
            defaultMessage,
          })}
        </SizableText>
      </XStack>
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
        isActive={!showWatchlistOnly}
        onPress={showWatchlistOnly ? onToggle : undefined}
        disabled={disabled}
        iconName="ChartTrendingUpOutline"
        translationId={ETranslations.market_trending}
        defaultMessage="Trending"
      />
      <ToggleButton
        isActive={showWatchlistOnly}
        onPress={!showWatchlistOnly ? onToggle : undefined}
        disabled={disabled}
        iconName="StarOutline"
        translationId={ETranslations.global_watchlist}
        defaultMessage="Watchlist"
      />
    </XStack>
  );
}
