/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';

// import * as SplashScreen from 'expo-splash-screen';
import { DeviceEventEmitter, LogBox } from 'react-native';

import { KitProvider } from '@onekeyhq/kit';
import { startTrace } from '@onekeyhq/shared/src/perf/perfTrace';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { Stack } from 'expo-router';
// import Head from 'expo-router/head';
import { Drawer } from 'expo-router/drawer';

startTrace('js_render');

// TODO: ExpoRouter: SplashScreen
// SplashScreen.preventAutoHideAsync();
LogBox.ignoreAllLogs();

DeviceEventEmitter.addListener('native_log_info', (event: string) => {
  debugLogger.native.info(event);
});

export default function Layout() {
  return (
    <>
      {/* TODO: ExpoRouter Error thrown in Head */}
      {/* <Head>
        <title>OneKey</title>
        <meta
          name="description"
          content="Multi-chain support for BTC/ETH/BNB/NEAR/Polygon/Solana/Avalanche/Fantom and others"
        />
      </Head> */}
      <KitProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </KitProvider>
    </>
  );
}
