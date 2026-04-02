import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useOrderFilterByCurrentTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showCancelAllOrdersDialog } from '../CancelAllOrdersModal';

interface IMobileOpenOrdersListHeaderProps {
  totalOrderCount: number;
}

export function MobileOpenOrdersListHeader({
  totalOrderCount,
}: IMobileOpenOrdersListHeaderProps) {
  const intl = useIntl();
  const [filterByCurrentToken, setFilterByCurrentToken] =
    useOrderFilterByCurrentTokenAtom();

  const handleCancelAll = useCallback(() => {
    void showCancelAllOrdersDialog();
  }, []);

  const handleFilterChange = useCallback(
    (value: boolean | 'indeterminate') => {
      setFilterByCurrentToken(value === true);
    },
    [setFilterByCurrentToken],
  );

  // Early return when no orders exist
  if (totalOrderCount === 0) {
    return null;
  }

  return (
    <XStack
      px="$5"
      pt="$2.5"
      justifyContent="space-between"
      alignItems="center"
      bg="$bgApp"
    >
      {/* Left: Filter checkbox - same style as TP/SL checkbox in trading form */}
      <Checkbox
        label={intl.formatMessage({
          id: ETranslations.perps_hide_other_symbols,
        })}
        labelProps={{ fontSize: '$bodyXs' }}
        containerProps={{ p: '$0', alignItems: 'center' }}
        width="$3.5"
        height="$3.5"
        value={filterByCurrentToken}
        onChange={handleFilterChange}
      />

      {/* Right: Cancel all button - disabled only when no orders to cancel */}
      <Button
        size="small"
        variant="secondary"
        disabled={totalOrderCount === 0}
        onPress={handleCancelAll}
      >
        <SizableText size="$bodyXs">
          {intl.formatMessage({
            id: ETranslations.perp_open_orders_cancel_all,
          })}
        </SizableText>
      </Button>
    </XStack>
  );
}
