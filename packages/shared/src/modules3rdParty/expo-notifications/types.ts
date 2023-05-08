// <<<<< ReferenceError: localStorage is not defined
// export { IosAuthorizationStatus } from 'expo-notifications';

export enum IosAuthorizationStatus {
  NOT_DETERMINED = 0,
  DENIED = 1,
  AUTHORIZED = 2,
  PROVISIONAL = 3,
  EPHEMERAL = 4,
}

export type { NotificationPermissionsStatus } from 'expo-notifications';
