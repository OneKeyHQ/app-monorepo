import 'expo-dev-client';
import React, { FC } from 'react';
import Home from '@onekeyhq/kit/src/pages/Home';
import { KitApp, StackNavigator } from '@onekeyhq/kit';
import BleDeviceDemo from './src/temp/BleDeviceDemo';
import LiteDemo from './src/temp/LiteDemo';
import WebViewDemo from './src/temp/WebViewDemo';

const App: FC = function () {
  // return <LiteDemo />;
  // return <BleDeviceDemo />;

  return (
    <KitApp>
      <StackNavigator.Navigator>
        <StackNavigator.Screen name="Home" component={Home} />
        <StackNavigator.Screen name="WebViewDemo" component={WebViewDemo} />
        <StackNavigator.Screen name="LiteDemo" component={LiteDemo} />
        <StackNavigator.Screen name="BleDeviceDemo" component={BleDeviceDemo} />
      </StackNavigator.Navigator>
    </KitApp>
  );
};

export default App;
