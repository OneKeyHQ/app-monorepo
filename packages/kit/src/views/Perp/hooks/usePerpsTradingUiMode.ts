import { useMedia } from '@onekeyhq/components';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPerpsTradingUiMode } from '@onekeyhq/shared/types/hyperliquid/types';

export function usePerpsTradingUiMode(): IPerpsTradingUiMode {
  const { gtMd } = useMedia();
  const [settings] = usePerpsCustomSettingsAtom();
  return (platformEnv.isNative || !gtMd) &&
    settings.mobileTradingMode === 'simple'
    ? 'simple'
    : 'pro';
}
