import { useCallback } from 'react';

import { Button, Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { usePositionFilterByCurrentTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { showCloseAllPositionsDialog } from '../CloseAllPositionsModal';

interface IMobilePositionsListHeaderProps {
  totalPositionCount: number;
  filteredPositionCount: number;
}

export function MobilePositionsListHeader({
  totalPositionCount,
  filteredPositionCount,
}: IMobilePositionsListHeaderProps) {
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
      py="$2.5"
      justifyContent="space-between"
      alignItems="center"
      bg="$bgApp"
    >
      {/* Left: Filter checkbox */}
      <Checkbox
        label={`Only show ${activeAsset?.coin || ''}`}
        labelProps={{
          fontSize: '$bodySm',
        }}
        value={filterByCurrentToken}
        onChange={handleFilterChange}
      />

      {/* Right: Close all button - disabled when trading is not enabled or no positions */}
      <Button
        size="medium"
        variant="secondary"
        disabled={!isAgentReady || filteredPositionCount === 0}
        onPress={handleCloseAll}
      >
        <SizableText size="$bodySm">Close All</SizableText>
      </Button>
    </XStack>
  );
}
