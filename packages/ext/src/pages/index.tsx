import React, { FC } from 'react';
import ReactDOM from 'react-dom';

import Home from '@onekeyhq/kit/src/pages/Home';
import { Provider, StackNavigator } from '@onekeyhq/kit';
import inpageProviderUi from '@onekeyhq/inpage-provider/src/extension/ui';
import hotReload from './hotReload';

import './index.css';

// @ts-ignore
window.jsBridgeUi = inpageProviderUi.createUiJsBridge();

const RootApp: FC = function () {
  return (
    <Provider>
      <StackNavigator.Navigator>
        <StackNavigator.Screen name="Home" component={Home} />
      </StackNavigator.Navigator>
    </Provider>
  );
};

ReactDOM.render(<RootApp />, window.document.querySelector('#app-container'));

hotReload.enable();
