import {
  type ISharedStore,
  getSharedStore,
} from '@onekeyfe/react-native-background-thread';

export type IBackgroundThreadSharedStore = ISharedStore;

export function getBackgroundThreadSharedStore():
  | IBackgroundThreadSharedStore
  | undefined {
  return getSharedStore();
}
