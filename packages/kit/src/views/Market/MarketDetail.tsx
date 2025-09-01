import type { IPageScreenProps } from '@onekeyhq/components';

import { MarketDetailV1 } from './MarketDetailV1';
import MarketDetailV2 from './MarketDetailV2';

export type IMarketDetailProps = IPageScreenProps<any, any>;

export default function MarketDetail(props: IMarketDetailProps) {
  const { route } = props;

  // Default to V2, fallback to V1 for specific parameter combinations
  if (route.params?.tokenAddress && route.params?.networkId) {
    return <MarketDetailV2 {...(props as any)} />;
  }

  // Use V2 by default
  return <MarketDetailV2 {...(props as any)} />;
}
