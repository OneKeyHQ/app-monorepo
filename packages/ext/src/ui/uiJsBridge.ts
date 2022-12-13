import {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import {
  DISPATCH_ACTION_BROADCAST_METHOD_NAME,
  IDispatchActionBroadcastParams,
  buildReduxBatchAction,
} from '@onekeyhq/kit/src/background/utils';
import store from '@onekeyhq/kit/src/store';

function init() {
  const jsBridgeReceiveHandler = (payload: IJsBridgeMessagePayload) => {
    console.log('jsBridgeReceiveHandler Ext-UI', payload);
    const { method, params } = payload.data as IJsonRpcRequest;
    if (method === DISPATCH_ACTION_BROADCAST_METHOD_NAME) {
      const { actions } = params as IDispatchActionBroadcastParams;
      if (actions && actions.length) {
        const actionData = buildReduxBatchAction(...actions);
        if (actionData) {
          // * update Ext ui store
          store.dispatch(actionData);
        }
      }
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
