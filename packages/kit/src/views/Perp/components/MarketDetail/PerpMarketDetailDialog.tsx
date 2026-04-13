import { useCallback, useMemo } from 'react';

import { Dialog, IconButton, YStack, useMedia } from '@onekeyhq/components';
import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpMarketDetailContent } from './PerpMarketDetailContent';

function PerpMarketDetailDialogContent({
  coin,
  displayName,
}: {
  coin?: string;
  displayName?: string;
}) {
  const { gtMd } = useMedia();

  return (
    <YStack width={gtMd ? 760 : '100%'} maxWidth="100%" minHeight={0}>
      <PerpMarketDetailContent
        coin={coin}
        displayName={displayName}
        paddingX="$5"
        paddingTop="$4"
        paddingBottom="$5"
        maxHeight={gtMd ? 560 : 480}
      />
    </YStack>
  );
}

export function showPerpMarketDetailDialog({
  title,
  coin,
  displayName,
}: {
  title: string;
  coin?: string;
  displayName?: string;
}) {
  Dialog.show({
    title,
    showFooter: false,
    renderContent: (
      <PerpMarketDetailDialogContent coin={coin} displayName={displayName} />
    ),
  });
}

export function PerpMarketDetailButton() {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const assetCoin = activeAsset?.coin;
  const { displayName } = useMemo(
    () => parseDexCoin(assetCoin ?? ''),
    [assetCoin],
  );

  const handlePress = useCallback(() => {
    if (!assetCoin) {
      return;
    }
    showPerpMarketDetailDialog({
      title: `${displayName || assetCoin || 'Perp'} Market Data`,
      coin: assetCoin,
      displayName,
    });
  }, [assetCoin, displayName]);

  return (
    <IconButton
      icon="InfoCircleOutline"
      size="small"
      iconProps={{ color: '$iconSubdued' }}
      variant="tertiary"
      disabled={!assetCoin}
      onPress={handlePress}
    />
  );
}
