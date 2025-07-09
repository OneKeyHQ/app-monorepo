import { MarketHomeV1 } from './MarketHomeV1';
import { MarketHomeV2 } from './MarketHomeV2';

export interface IMarketHomeProps {
  version: 'v1' | 'v2';
}

export default function MarketHome({ version, ...rest }: IMarketHomeProps) {
  if (version === 'v2') {
    return <MarketHomeV2 {...(rest as any)} />;
  }

  return <MarketHomeV1 {...(rest as any)} />;
}
