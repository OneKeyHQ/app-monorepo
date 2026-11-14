import { useHideIntercomMessengerWhenLocked } from './useHideIntercomMessengerWhenLocked';

export function IntercomLockGuard() {
  useHideIntercomMessengerWhenLocked();
  return null;
}
