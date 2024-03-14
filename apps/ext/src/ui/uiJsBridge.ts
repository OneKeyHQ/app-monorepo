import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInit';
import type {
  IGlobalEventBusSyncBroadcastParams,
  IGlobalStatesSyncBroadcastParams,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  GLOBAL_EVENT_BUS_SYNC_BROADCAST_METHOD_NAME,
  GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

function init() {
  const jsBridgeReceiveHandler = async (payload: IJsBridgeMessagePayload) => {
    // console.log('jsBridgeReceiveHandler Ext-UI', payload);
    const { method, params } = payload.data as IJsonRpcRequest;
    if (method === GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME) {
      // console.log('background states sync', params);
      await jotaiUpdateFromUiByBgBroadcast(
        params as IGlobalStatesSyncBroadcastParams,
      );
    }
    if (method === GLOBAL_EVENT_BUS_SYNC_BROADCAST_METHOD_NAME) {
      console.log('background event bus sync', params);
      const p = params as IGlobalEventBusSyncBroadcastParams;
      appEventBus.emitToSelf(p.type as any, p.payload);
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
