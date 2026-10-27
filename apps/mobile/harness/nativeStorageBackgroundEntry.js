import { getClient } from '@react-native-harness/runtime/dist/client';
import { getDeviceDescriptor } from '@react-native-harness/runtime/dist/client/getDeviceDescriptor';
import { AppRegistry } from 'react-native';

// Android exposes the migration module only in the background ReactHost.
// Use a separate bridge so tests cannot accidentally run in the main JS heap.
globalThis.RN_HARNESS.webSocketPort += 1;
AppRegistry.registerComponent('background', () => () => null);
void getClient().then((client) =>
  client.rpc.reportReady(getDeviceDescriptor()),
);
