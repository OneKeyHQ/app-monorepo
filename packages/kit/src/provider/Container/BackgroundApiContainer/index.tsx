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
      jsBundleSource="sandbox" // The JS bundle: file name or URL
      componentName="SandboxApp" // Name of component registered in bundle provided with jsBundleSource
      onMessage={handleMessage}
      onError={handleError}
    />
  );
}

export default BackgroundApiContainer;
