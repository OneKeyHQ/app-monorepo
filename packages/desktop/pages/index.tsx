import React, { FC, useState } from 'react';

import { DemoInpageProviderDesktop } from '@onekeyhq/inpage-provider/src/demo/DemoInpageProvider';
import DeviceConnection from '@onekeyhq/kit/src/views/DeviceConnection';
import { Button } from '@onekeyhq/components';

const App: FC = function () {
  const [webviewDemo, setWebviewDemo] = useState(false);
  if (webviewDemo) {
    return <DemoInpageProviderDesktop />;
  }
  return (
    <>
      <Button onPress={() => setWebviewDemo(true)}>Show Webview Demo</Button>
      <DeviceConnection />
    </>
  );
};

export default App;
