import { useHideIntercomMessengerWhenLocked } from './useHideIntercomMessengerWhenLocked';

// Keep support requests locked even while a cold-start lock defers the app
// tree and its notification container.
export function IntercomLockGuard() {
  useHideIntercomMessengerWhenLocked();
  return null;
}
