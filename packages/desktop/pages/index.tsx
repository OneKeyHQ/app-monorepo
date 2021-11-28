import React, { FC } from 'react';

import { DemoInpageProviderDesktop } from '@onekeyhq/inpage-provider/src/demo/DemoInpageProvider';
import DesktopWebView from '@onekeyhq/inpage-provider/src/webview/DesktopWebView';
import path from 'path';
// import DeviceConnection from '@onekeyhq/kit/src/views/DeviceConnection';

function initWebviewPreloadUrl() {
  const STATIC_ROOT = process.env.STATIC_ROOT || '';
  // eslint-disable-next-line @typescript-eslint/no-var-requires,no-undef,@typescript-eslint/restrict-template-expressions,global-require
  const preloadJs = `file://${path.join(STATIC_ROOT, 'preload.js')}`;
  // @ts-ignore
  DesktopWebView.preloadJsUrl = preloadJs;
}
initWebviewPreloadUrl();

const App: FC = function () {
  return <DemoInpageProviderDesktop />;
  // return <DeviceConnection />;
};

export default App;
