import type {
  check as RNCheck,
  checkMultiple as RNCheckMultiple,
  openSettings as RNOpenSettings,
  PermissionStatus as RNPermissionStatus,
  PERMISSIONS as RN_PERMISSIONS,
  RESULTS as RN_RESULTS,
} from 'react-native-permissions';

export const check = {} as typeof RNCheck;
export const PERMISSIONS = {} as typeof RN_PERMISSIONS;
export const RESULTS = {} as typeof RN_RESULTS;
export const checkMultiple = {} as typeof RNCheckMultiple;
export const PermissionStatus = {} as RNPermissionStatus;
export const openSettings = {} as typeof RNOpenSettings;
