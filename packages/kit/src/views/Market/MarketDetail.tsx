import { MarketDetailV1 } from './MarketDetailV1';
import { MarketDetailV2 } from './MarketDetailV2';

export interface IMarketDetailProps {
  version: 'v1' | 'v2';
}

export default function MarketDetail({ version, ...rest }: IMarketDetailProps) {
  if (version === 'v2') {
    return <MarketDetailV2 {...(rest as any)} />;
  }

  return <MarketDetailV1 {...(rest as any)} />;
}
