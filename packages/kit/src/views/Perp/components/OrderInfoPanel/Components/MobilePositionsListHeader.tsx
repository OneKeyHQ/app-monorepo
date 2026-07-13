import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { usePositionFilterByCurrentTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showCloseAllPositionsDialog } from '../CloseAllPositionsModal';

interface IMobilePositionsListHeaderProps {
  totalPositionCount: number;
  canCloseAll: boolean;
  scopedAccountAddress?: string | null;
}

export function MobilePositionsListHeader({
  totalPositionCount,
  canCloseAll,
  scopedAccountAddress,
}: IMobilePositionsListHeaderProps) {
  const intl = useIntl();
  const [filterByCurrentToken, setFilterByCurrentToken] =
    usePositionFilterByCurrentTokenAtom();

  const handleCloseAll = useCallback(() => {
    if (canCloseAll) {
      void showCloseAllPositionsDialog(undefined, scopedAccountAddress);
    }
  }, [canCloseAll, scopedAccountAddress]);

  const handleFilterChange = useCallback(
    (value: boolean | 'indeterminate') => {
      setFilterByCurrentToken(value === true);
    },
    [setFilterByCurrentToken],
  );

  // Early return when no positions exist
  if (totalPositionCount === 0) {
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

      {/* Right: Close all button */}
      <Button
        testID="perp-btn"
        size="small"
        variant="secondary"
        disabled={totalPositionCount === 0 || !canCloseAll}
        onPress={handleCloseAll}
        childrenAsText={false}
      >
        <SizableText size="$bodyXs">
          {intl.formatMessage({ id: ETranslations.perp_position_close })}
        </SizableText>
      </Button>
    </XStack>
  );
}
