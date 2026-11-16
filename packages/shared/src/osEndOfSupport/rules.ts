import type { IOsEndOfSupportRules } from './types';

// Switch for the "your OS version will lose support" notice on Home.
// Empty = off everywhere. To announce a drop, add the platform here and ship
// it in an OTA bundle; only devices below the threshold see the notice.
//
// Example: announce that iOS 16 support is ending
//   ios: {
//     minSupportedVersion: '17.0',
//     minSupportedName: 'iOS 17',
//     learnMoreUrl: 'https://help.onekey.so/...',
//   },
//   mac: { minSupportedVersion: '12.0', minSupportedName: 'macOS 12' },
//   win: { minSupportedVersion: '10.0.22000', minSupportedName: 'Windows 11' },
export const OS_END_OF_SUPPORT_RULES: IOsEndOfSupportRules = {
  // Android 10 (API 29) and below will be dropped in two releases.
  // Android versions are compared by API level.
  android: { minSupportedVersion: '30', minSupportedName: 'Android 11' },
};
