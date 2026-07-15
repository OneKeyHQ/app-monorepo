import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useOrderFilterByCurrentTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showCancelAllOrdersDialog } from '../CancelAllOrdersModal';

interface IMobileOpenOrdersListHeaderProps {
  totalOrderCount: number;
  scopedAccountAddress?: string | null;
  cancelableOrderCount?: number;
}

export function MobileOpenOrdersListHeader({
  totalOrderCount,
  scopedAccountAddress,
  cancelableOrderCount = totalOrderCount,
}: IMobileOpenOrdersListHeaderProps) {
  const intl = useIntl();
  const [filterByCurrentToken, setFilterByCurrentToken] =
    useOrderFilterByCurrentTokenAtom();
  const canCancelAll = cancelableOrderCount > 0;

  const handleCancelAll = useCallback(() => {
    if (canCancelAll) {
      void showCancelAllOrdersDialog(undefined, scopedAccountAddress);
    }
  }, [canCancelAll, scopedAccountAddress]);

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
      px="$4"
      pt="$2.5"
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

      {canCancelAll ? (
        <Button
          testID="perp-btn"
          size="small"
          variant="secondary"
          onPress={handleCancelAll}
          childrenAsText={false}
        >
          <SizableText size="$bodyXs">
            {intl.formatMessage({
              id: ETranslations.perp_open_orders_cancel_all,
            })}
          </SizableText>
        </Button>
      ) : null}
    </XStack>
  );
}
