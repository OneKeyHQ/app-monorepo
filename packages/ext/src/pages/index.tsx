// @ts-nocheck
import React, { FC } from 'react';
import ReactDOM from 'react-dom';

import Home from '@onekeyhq/kit/src/pages/Home';
import { KitApp, StackNavigator } from '@onekeyhq/kit';

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

if (module.hot) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  module.hot.accept();
}
