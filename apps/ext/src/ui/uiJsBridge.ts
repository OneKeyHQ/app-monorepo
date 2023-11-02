import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import store from '@onekeyhq/kit/src/store';
import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInit';
import type {
  IDispatchActionBroadcastParams,
  IGlobalStatesSyncBroadcastParams,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  DISPATCH_ACTION_BROADCAST_METHOD_NAME,
  GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME,
  buildReduxBatchAction,
} from '@onekeyhq/shared/src/background/backgroundUtils';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

function init() {
  const jsBridgeReceiveHandler = async (payload: IJsBridgeMessagePayload) => {
    // console.log('jsBridgeReceiveHandler Ext-UI', payload);
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
