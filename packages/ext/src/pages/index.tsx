import React, { FC } from 'react';
import ReactDOM from 'react-dom';

import Home from '@onekeyhq/kit/src/pages/Home';
import { KitApp, StackNavigator } from '@onekeyhq/kit';
import hotReload from './hotReload';

import './index.css';

const RootApp: FC = function () {
  return (
    <KitApp>
      <StackNavigator.Navigator>
        <StackNavigator.Screen name="Home" component={Home} />
      </StackNavigator.Navigator>
    </KitApp>
  );
};

ReactDOM.render(<RootApp />, window.document.querySelector('#app-container'));

hotReload.enable();
