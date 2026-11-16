import { useSyncExternalStore } from 'react';

import { makeMutable } from 'react-native-reanimated';

// Open state of the phone profile drawer (OneKey ID, account and app
// entries). UI-only state, so it lives in the UI runtime only.
type IListener = () => void;

let isOpen = false;
const listeners = new Set<IListener>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: IListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return isOpen;
}

export function openProfileDrawer() {
  if (isOpen) return;
  isOpen = true;
  emit();
}

export function closeProfileDrawer() {
  if (!isOpen) return;
  isOpen = false;
  emit();
}

// Mirrors a finished user open or close from the native drawer.
export function setProfileDrawerOpen(open: boolean) {
  if (open) openProfileDrawer();
  else closeProfileDrawer();
}

// Follows the drawer frame by frame so the header avatar can hand over to
// the drawer's own avatar as the page slides away.
export const profileDrawerProgress = makeMutable(0);

export function useIsProfileDrawerOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
