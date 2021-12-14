import 'expo-dev-client';
import React, { FC } from 'react';
import { Provider } from '@onekeyhq/kit';

console.disableYellowBox = true;

const App: FC = function () {
  return <Provider />;
};

export default App;
