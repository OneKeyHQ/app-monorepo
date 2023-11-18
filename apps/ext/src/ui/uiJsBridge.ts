import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInit';
import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import { GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME } from '@onekeyhq/shared/src/background/backgroundUtils';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

function init() {
  const jsBridgeReceiveHandler = async (payload: IJsBridgeMessagePayload) => {
    // console.log('jsBridgeReceiveHandler Ext-UI', payload);
    const { method, params } = payload.data as IJsonRpcRequest;
    if (method === GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME) {
      console.log(
        'background GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME',
        params,
      );
      await jotaiUpdateFromUiByBgBroadcast(
        params as IGlobalStatesSyncBroadcastParams,
      );
    }
  };
  // TODO rename global.$extensionJsBridgeUiToBg
  window.extJsBridgeUiToBg = bridgeSetup.ui.createUiJsBridge({
    receiveHandler: jsBridgeReceiveHandler,
    onPortConnect() {
      // use <WaitBackgroundReady /> instead
      // legacy method:    syncWholeStoreState();
    },
  });
}

export default {
  init,
};
