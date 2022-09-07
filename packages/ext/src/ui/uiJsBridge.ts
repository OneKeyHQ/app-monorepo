import {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  DISPATCH_ACTION_BROADCAST_METHOD_NAME,
  IDispatchActionBroadcastParams,
  buildReduxBatchAction,
} from '@onekeyhq/kit/src/background/utils';
import store from '@onekeyhq/kit/src/store';

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
      // syncWholeStoreState();
    },
  });
}

export default {
  init,
};
