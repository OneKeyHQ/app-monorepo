import { configureObservablePersistence } from '@legendapp/state/persist';
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv';

// Global configuration
configureObservablePersistence({
  // Use react-native-mmkv in React Native
  persistLocal: ObservablePersistMMKV,
});
