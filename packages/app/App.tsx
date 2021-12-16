import React, { FC } from 'react';

import 'expo-dev-client';

import { Provider } from '@onekeyhq/kit';

console.disableYellowBox = true;

const App: FC = function () {
  return <Provider />;
};

export default App;
