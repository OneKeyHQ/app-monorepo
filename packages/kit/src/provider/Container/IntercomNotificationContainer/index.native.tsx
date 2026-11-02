import { useHideIntercomMessengerWhenLocked } from './useHideIntercomMessengerWhenLocked';

// Native keeps Intercom in-app messages off; only the lock guard applies.
export function IntercomNotificationContainer() {
  useHideIntercomMessengerWhenLocked();
  return null;
}
