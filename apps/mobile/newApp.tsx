import { Text, View } from 'react-native';

export function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>
        getJsReadyFromPerformanceNow:{' '}
        {(globalThis.$$onekeyJsReadyFromPerformanceNow || 0) -
          __BUNDLE_START_TIME__}
      </Text>
      <Text>
        getUIVisibleFromPerformanceNow:{' '}
        {(globalThis.$$onekeyAppWillMountFromPerformanceNow || 0) -
          __BUNDLE_START_TIME__}
      </Text>
    </View>
  );
}
