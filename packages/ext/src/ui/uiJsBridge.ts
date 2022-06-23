import {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';
import { PayloadAction } from '@reduxjs/toolkit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import store from '@onekeyhq/kit/src/store';
import { UIResponse } from '@onekeyhq/kit/src/utils/hardware';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function syncWholeStoreState() {
  backgroundApiProxy
    .getState()
    .then(({ state, bootstrapped }: { state: any; bootstrapped: boolean }) => {
      console.log('Sync full state from background', bootstrapped, state);
      // close window if background redux not ready yet.
      if (!bootstrapped) {
        window.close();
      }
      store.dispatch({
        // TODO use consts
        type: 'REPLACE_WHOLE_STATE',
        payload: state,
        $isDispatchFromBackground: true,
      });
    });
}

function init() {
  const jsBridgeReceiveHandler = (payload: IJsBridgeMessagePayload) => {
    console.log('jsBridgeReceiveHandler Ext-UI', payload);
    const { method, params } = payload.data as IJsonRpcRequest;
    if (method === 'dispatchActionBroadcast') {
      store.dispatch(params as PayloadAction);
    } else if (method === 'SDKBackgroundBroadcastUIEvent') {
      UIResponse(params, true);
    }
  };
  // TODO rename global.$extensionJsBridgeUiToBg
  window.extJsBridgeUiToBg = bridgeSetup.ui.createUiJsBridge({
    receiveHandler: jsBridgeReceiveHandler,
    onPortConnect() {
      // use <WaitBackgroundReady /> instead
      // syncWholeStoreState();
    },
  });
}

export default {
  init,
};
