import { useCallback, useRef } from 'react';

import SandboxReactNativeView from '@callstack/react-native-sandbox';

import type { SandboxReactNativeViewRef } from '@callstack/react-native-sandbox';

function BackgroundApiContainer() {
  const sandboxRef = useRef<SandboxReactNativeViewRef>(null);

  const handleMessage = useCallback((message: string) => {
    console.log('message', message);
  }, []);

  const handleError = useCallback((error: string) => {
    console.log('handleError', error);
  }, []);

  return (
    <SandboxReactNativeView
      ref={sandboxRef}
      jsBundleSource="http://localhost:8082/apps/mobile/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&app=so.onekey.wallet&transform.routerRoot=app&transform.engine=hermes&transform.bytecode=1&unstable_transformProfile=hermes-stable"
      componentName="SandboxApp"
      onMessage={handleMessage}
      onError={handleError}
    />
  );
}

export default BackgroundApiContainer;
