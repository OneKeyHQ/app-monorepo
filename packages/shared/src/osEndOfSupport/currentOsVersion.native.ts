import { Platform } from 'react-native';

// iOS reports the OS version ('16.7.2'); Android reports the API level (29).
export function getCurrentOsVersion(): string | undefined {
  return String(Platform.Version);
}
