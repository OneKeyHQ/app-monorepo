import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { usePositionFilterByCurrentTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showCloseAllPositionsDialog } from '../CloseAllPositionsModal';

interface IMobilePositionsListHeaderProps {
  totalPositionCount: number;
  filteredPositionCount: number;
}

export function MobilePositionsListHeader({
  totalPositionCount,
  filteredPositionCount,
}: IMobilePositionsListHeaderProps) {
  const intl = useIntl();
  const [filterByCurrentToken, setFilterByCurrentToken] =
    usePositionFilterByCurrentTokenAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [{ isAgentReady }] = usePerpsActiveAccountIsAgentReadyAtom();

  const handleCloseAll = useCallback(() => {
    void showCloseAllPositionsDialog(
      filterByCurrentToken ? activeAsset?.coin : undefined,
    );
  }, [filterByCurrentToken, activeAsset?.coin]);

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
        label={intl.formatMessage({ id: ETranslations.perps_hide_other_symbols })}
        labelProps={{ fontSize: '$bodyXs' }}
        containerProps={{ p: '$0', alignItems: 'center' }}
        width="$3.5"
        height="$3.5"
        value={filterByCurrentToken}
        onChange={handleFilterChange}
      />

      {/* Right: Close all button - disabled when trading is not enabled or no positions */}
      <Button
        size="small"
        variant="secondary"
        disabled={!isAgentReady || filteredPositionCount === 0}
        onPress={handleCloseAll}
      >
        <SizableText size="$bodyXs">
          {intl.formatMessage({ id: ETranslations.perp_position_close })}
        </SizableText>
      </Button>
    </XStack>
  );
}
