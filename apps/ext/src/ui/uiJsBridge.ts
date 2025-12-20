import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type {
  IGlobalEventBusSyncBroadcastParams,
  IGlobalStatesSyncBroadcastParams,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  GLOBAL_EVENT_BUS_SYNC_BROADCAST_METHOD_NAME,
  GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
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
      appEventBus.emitToSelf({
        type: p.type as any,
        payload: p.payload,
        isRemote: true,
      });
    }
  };
  // TODO rename global.$extensionJsBridgeUiToBg
  appGlobals.extJsBridgeUiToBg = bridgeSetup.ui.createUiJsBridge({
    receiveHandler: jsBridgeReceiveHandler,
    onPortConnect() {
      // use <WaitBackgroundReady /> instead
      // legacy method:    syncWholeStoreState();
    },
  }) as unknown as JsBridgeBase;
}

export default {
  init,
};
