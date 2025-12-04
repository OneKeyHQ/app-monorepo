import { CacheResult } from './type';

import type { IDualScreenInfoRect, ISpanningEventListener } from './type';

/**
 * Check if the device is a dual-screen or foldable device
 */
export async function isDualScreenDevice(): Promise<boolean> {
  return Promise.resolve(CacheResult.isDualScreenDevice);
}

/**
 * Check if the app is currently spanning across screens
 */
export async function isSpanning(): Promise<boolean> {
  return Promise.resolve(CacheResult.isSpanning);
}

/**
 * Get the window rectangles for each screen region
 * Returns an array of rectangles representing each visible screen area (excluding the hinge/fold area)
 */
export async function getWindowRects(): Promise<IDualScreenInfoRect[]> {
  return Promise.resolve([]);
}

/**
 * Get the bounds of the hinge/fold area
 * Returns null if there's no hinge or if the device is not foldable
 */
export async function getHingeBounds(): Promise<IDualScreenInfoRect | null> {
  return Promise.resolve(null);
}

/**
 * Add a listener for spanning state changes
 * @param listener Callback function that will be called when spanning state changes
 * @returns Subscription object with a remove() method to unsubscribe
 */
export function addSpanningListener(_: ISpanningEventListener): {
  remove: () => void;
} {
  return { remove: () => {} };
}

/**
 * Remove all spanning listeners
 */
export function removeAllSpanningListeners(): void {}
