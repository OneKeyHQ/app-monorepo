import { createPrivacyChainRelayTargetSource } from '@onekeyhq/kit-bg/src/utils/privacyChainRelayTargets';
import appGlobals from '@onekeyhq/shared/src/appGlobals';

// Read at request time: the listeners install before the background API.
export const backgroundPrivacyChainRelayTargets =
  createPrivacyChainRelayTargetSource({
    get servicePrivacyChain() {
      return appGlobals.$$backgroundApi.servicePrivacyChain;
    },
    get serviceCustomRpc() {
      return appGlobals.$$backgroundApi.serviceCustomRpc;
    },
  });
