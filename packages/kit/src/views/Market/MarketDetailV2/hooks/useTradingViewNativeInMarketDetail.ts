import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

export function useTradingViewNativeInMarketDetail() {
  const [devSettings] = useDevSettingsPersistAtom();

  return Boolean(
    devSettings.enabled &&
    devSettings.settings?.useTradingViewNativeInMarketDetail,
  );
}
