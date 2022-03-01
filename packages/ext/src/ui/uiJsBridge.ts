import {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';
import { PayloadAction } from '@reduxjs/toolkit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import store from '@onekeyhq/kit/src/store';

function init() {
  const jsBridgeReceiveHandler = (payload: IJsBridgeMessagePayload) => {
    console.log('jsBridgeReceiveHandler Ext-UI', payload);
    const { method, params } = payload.data as IJsonRpcRequest;
    if (method === 'dispatchActionBroadcast') {
      store.dispatch(params as PayloadAction);
    }
  };
  // TODO rename global.$extensionJsBridgeUiToBg
  window.extJsBridgeUiToBg = bridgeSetup.ui.createUiJsBridge({
    receiveHandler: jsBridgeReceiveHandler,
    onPortConnect() {
      backgroundApiProxy.getStoreState().then((state: any) => {
        console.log('state from background', state);
        store.dispatch({
          // TODO use consts
          type: 'REPLACE_WHOLE_STATE',
          payload: state,
        });
      });
    },
  });
}

export default {
  init,
};
