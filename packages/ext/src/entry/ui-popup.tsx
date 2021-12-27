/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import React from 'react';

import { PayloadAction } from '@reduxjs/toolkit';
import ReactDOM from 'react-dom';

import inpageProviderUi from '@onekeyhq/inpage-provider/src/extension/ui';
import {
  IInpageProviderRequestData,
  IJsBridgeMessagePayload,
} from '@onekeyhq/inpage-provider/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import store from '@onekeyhq/kit/src/store';

import App from '../App';
import hotReload from '../ui/hotReload';
import popupSizeFix from '../ui/popupSizeFix';

popupSizeFix();
const jsBridgeReceiveHandler = (payload: IJsBridgeMessagePayload) => {
  console.log('jsBridgeReceiveHandler Ext-UI', payload);
  const { method, params } = payload.data as IInpageProviderRequestData;
  if (method === 'dispatchActionBroadcast') {
    store.dispatch(params as PayloadAction);
  }
};
// TODO rename global.$extensionJsBridgeUiToBg
window.extJsBridgeUiToBg = inpageProviderUi.createUiJsBridge({
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

ReactDOM.render(<App />, window.document.querySelector('#root'));
hotReload.enable();
