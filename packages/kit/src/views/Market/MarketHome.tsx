import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import MarketHomeV1 from './MarketHomeV1/MarketHome';
import { MarketHomeV2 } from './MarketHomeV2';

export default function MarketHome(props: any) {
  const [devSettings] = useDevSettingsPersistAtom();
  const enableMarketV2 = devSettings.settings?.enableMarketV2 ?? false;

  if (enableMarketV2) {
    return <MarketHomeV2 {...props} />;
  }

  return <MarketHomeV1 {...props} />;
}
