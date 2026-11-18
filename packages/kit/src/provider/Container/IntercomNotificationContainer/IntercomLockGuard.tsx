import { useSyncIntercomLockState } from './useSyncIntercomLockState';

// Keep support requests locked even while a cold-start lock defers the app
// tree and its notification container.
export function IntercomLockGuard() {
  useSyncIntercomLockState();
  return null;
}
