import {
  useSwapProSelectTokenAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useBtcMetadataFromTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useBtcMetadata';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { BtcTokenDetailGroup } from './BtcTokenDetailGroup';
import { ITEM_TITLE_PROPS, ITEM_VALUE_PROPS } from './constants';
import { NormalTokenDetailGroup } from './NormalTokenDetailGroup';
import {
  type IStockTokenDetail,
  StockTokenDetailGroup,
} from './StockTokenDetailGroup';

function isStockTokenDetail(
  tokenDetail?: IMarketTokenDetail,
): tokenDetail is IStockTokenDetail {
  return !!tokenDetail?.stock;
}

function SwapProTokenDetailGroup() {
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const btcMetadata = useBtcMetadataFromTokenDetail({
    tokenDetail: tokenMarketDetailInfo,
    networkId:
      tokenMarketDetailInfo?.networkId ?? swapProSelectToken?.networkId,
  });

  if (btcMetadata) {
    return <BtcTokenDetailGroup btcMetadata={btcMetadata} />;
  }

  if (isStockTokenDetail(tokenMarketDetailInfo)) {
    return <StockTokenDetailGroup tokenDetail={tokenMarketDetailInfo} />;
  }

  return (
    <NormalTokenDetailGroup
      tokenDetail={tokenMarketDetailInfo}
      isNative={swapProSelectToken?.isNative}
    />
  );
}

export { ITEM_TITLE_PROPS, ITEM_VALUE_PROPS };

export default SwapProTokenDetailGroup;
