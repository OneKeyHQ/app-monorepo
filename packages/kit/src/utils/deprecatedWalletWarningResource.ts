import { createUiResource } from '@onekeyhq/kit/src/hooks/uiResource';
import { swrCacheNamespaces } from '@onekeyhq/shared/src/utils/swrCacheUtils';

export const deprecatedWalletWarningResource = createUiResource(
  swrCacheNamespaces.deprecatedWalletWarning,
);
