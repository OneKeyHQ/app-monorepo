import { useHideIntercomMessengerWhenLocked } from './useHideIntercomMessengerWhenLocked';

// Mounted outside the lock container's deferred subtree so a rebuilt main
// runtime always hides native Intercom content, even when a low-memory
// cold-start lock skips rendering the app tree. Its first lock sync also
// resets in-app messages the previous runtime may have left visible.
export function IntercomLockGuard() {
  useHideIntercomMessengerWhenLocked();
  return null;
}
