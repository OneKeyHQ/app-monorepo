import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useOrderFilterByCurrentTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showCancelAllOrdersDialog } from '../CancelAllOrdersModal';

interface IMobileOpenOrdersListHeaderProps {
  totalOrderCount: number;
  cancelableOrderCount?: number;
}

export function MobileOpenOrdersListHeader({
  totalOrderCount,
  cancelableOrderCount = totalOrderCount,
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
      pt="$1"
      justifyContent="space-between"
      alignItems="center"
      bg="$bgApp"
    >
      {/* Left: Filter checkbox - same style as TP/SL checkbox in trading form */}
      <Checkbox
        testID="perp-handle-filter-change-checkbox"
        label={intl.formatMessage({
          id: ETranslations.perps_hide_other_pairs,
        })}
        labelProps={{ fontSize: '$bodyXs' }}
        containerProps={{ p: '$0', alignItems: 'center' }}
        width="$3.5"
        height="$3.5"
        value={filterByCurrentToken}
        onChange={handleFilterChange}
      />

      <Button
        testID="perp-btn"
        size="small"
        variant="secondary"
        onPress={cancelableOrderCount > 0 ? handleCancelAll : undefined}
        disabled={cancelableOrderCount === 0}
        opacity={cancelableOrderCount > 0 ? 1 : 0}
        pointerEvents={cancelableOrderCount > 0 ? 'auto' : 'none'}
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
