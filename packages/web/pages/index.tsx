import React, { FC } from 'react';

import Home from '@onekeyhq/kit/src/pages/Home';
import { KitApp, StackNavigator } from '@onekeyhq/kit';
import useLoadCustomFonts from '@onekeyhq/components/assets/fonts/static-fonts';

const App: FC = function () {
  const fontsLoaded = useLoadCustomFonts();
  if (!fontsLoaded) {
    return null;
  }
  return (
    <KitApp>
      <StackNavigator.Navigator>
        <StackNavigator.Screen name="Home" component={Home} />
      </StackNavigator.Navigator>
    </KitApp>
  );
};

export default App;
