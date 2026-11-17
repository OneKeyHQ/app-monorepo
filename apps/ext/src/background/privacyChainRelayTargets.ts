import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { createPrivacyChainRelayTargetSource } from '@onekeyhq/kit-bg/src/utils/privacyChainRelayTargets';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// $$backgroundApi is dev-only; the proxy holds the real instance in every build.
function getBackgroundApi(): IBackgroundApi {
  const backgroundApi = appGlobals.$backgroundApiProxy?.backgroundApi;
  if (!backgroundApi) {
    throw new OneKeyLocalError('Background API is not ready');
  }
  return backgroundApi;
}

// Read at request time: the listeners install before the background API.
export const backgroundPrivacyChainRelayTargets =
  createPrivacyChainRelayTargetSource({
    get servicePrivacyChain() {
      return getBackgroundApi().servicePrivacyChain;
    },
    get serviceCustomRpc() {
      return getBackgroundApi().serviceCustomRpc;
    },
  });
