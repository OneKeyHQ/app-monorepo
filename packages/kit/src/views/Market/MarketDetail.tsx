import type { IPageScreenProps } from '@onekeyhq/components';

import { MarketDetailV1 } from './MarketDetailV1';
import { MarketDetailV2 } from './MarketDetailV2';

export type IMarketDetailProps = IPageScreenProps<any, any>;

export default function MarketDetail(props: IMarketDetailProps) {
  const { route } = props;

  // `networkId` in params means the caller targeted V2 (it also carries
  // `network`/`tokenAddress`). V1 callers must not use that key for hints;
  // they pass `preferredNetworkId` instead.
  if (route.params?.networkId) {
    return <MarketDetailV2 {...(props as any)} />;
  }

  return <MarketDetailV1 {...(props as any)} />;
}
