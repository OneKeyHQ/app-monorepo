import React, { FC } from 'react';

import Home from '@onekeyhq/kit/src/pages/Home';
import { KitApp, StackNavigator } from '@onekeyhq/kit';

const App: FC = function () {
  return (
    <KitApp>
      <StackNavigator.Navigator>
        <StackNavigator.Screen name="Home" component={Home} />
      </StackNavigator.Navigator>
    </KitApp>
  );
};

export default App;
