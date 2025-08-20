import type { IPageScreenProps } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import { MarketDetailV1 } from './MarketDetailV1';
import MarketDetailV2 from './MarketDetailV2';

export type IMarketDetailProps = IPageScreenProps<any, any>;

export default function MarketDetail(props: IMarketDetailProps) {
  const { route } = props;
  const [devSettings] = useDevSettingsPersistAtom();

  // Check dev settings first, then fallback to parameter-based logic
  if (devSettings.settings?.enableMarketV2) {
    return <MarketDetailV2 {...(props as any)} />;
  }

  // V1 mode: use V1 for all routes
  if (!devSettings.settings?.enableMarketV2) {
    return <MarketDetailV1 {...(props as any)} />;
  }

  // Fallback: original logic for backward compatibility
  if (route.params?.tokenAddress && route.params?.networkId) {
    return <MarketDetailV2 {...(props as any)} />;
  }

  return <MarketDetailV1 {...(props as any)} />;
}
