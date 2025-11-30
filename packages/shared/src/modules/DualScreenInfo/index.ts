/**
 * DualScreenInfo Module
 * Provides information about dual-screen and foldable devices
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpanningEvent {
  isSpanning: boolean;
}

export type SpanningEventListener = (event: SpanningEvent) => void;

interface DualScreenInfoNativeModule {
  isDualScreenDevice(): Promise<boolean>;
  isSpanning(): Promise<boolean>;
  getWindowRects(): Promise<Rect[]>;
  getHingeBounds(): Promise<Rect | null>;
  getConstants(): {
    EVENT_DID_UPDATE_SPANNING: string;
  };
}

const LINKING_ERROR =
  "The package 'DualScreenInfo' doesn't seem to be linked. Make sure:\n\n" +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const DualScreenInfoNative: DualScreenInfoNativeModule = NativeModules.DualScreenInfo
  ? NativeModules.DualScreenInfo
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

let eventEmitter: NativeEventEmitter | null = null;

function getEventEmitter(): NativeEventEmitter {
  if (!eventEmitter) {
    eventEmitter = new NativeEventEmitter(DualScreenInfoNative as any);
  }
  return eventEmitter;
}

/**
 * Check if the device is a dual-screen or foldable device
 */
export async function isDualScreenDevice(): Promise<boolean> {
  try {
    return await DualScreenInfoNative.isDualScreenDevice();
  } catch (error) {
    console.warn('DualScreenInfo.isDualScreenDevice error:', error);
    return false;
  }
}

/**
 * Check if the app is currently spanning across screens
 */
export async function isSpanning(): Promise<boolean> {
  try {
    return await DualScreenInfoNative.isSpanning();
  } catch (error) {
    console.warn('DualScreenInfo.isSpanning error:', error);
    return false;
  }
}

/**
 * Get the window rectangles for each screen region
 * Returns an array of rectangles representing each visible screen area (excluding the hinge/fold area)
 */
export async function getWindowRects(): Promise<Rect[]> {
  try {
    return await DualScreenInfoNative.getWindowRects();
  } catch (error) {
    console.warn('DualScreenInfo.getWindowRects error:', error);
    return [];
  }
}

/**
 * Get the bounds of the hinge/fold area
 * Returns null if there's no hinge or if the device is not foldable
 */
export async function getHingeBounds(): Promise<Rect | null> {
  try {
    return await DualScreenInfoNative.getHingeBounds();
  } catch (error) {
    console.warn('DualScreenInfo.getHingeBounds error:', error);
    return null;
  }
}

/**
 * Add a listener for spanning state changes
 * @param listener Callback function that will be called when spanning state changes
 * @returns Subscription object with a remove() method to unsubscribe
 */
export function addSpanningListener(
  listener: SpanningEventListener
): { remove: () => void } {
  try {
    const constants = DualScreenInfoNative.getConstants();
    const emitter = getEventEmitter();
    const subscription = emitter.addListener(
      constants.EVENT_DID_UPDATE_SPANNING,
      listener
    );
    return subscription;
  } catch (error) {
    console.warn('DualScreenInfo.addSpanningListener error:', error);
    return { remove: () => {} };
  }
}

/**
 * Remove all spanning listeners
 */
export function removeAllSpanningListeners(): void {
  try {
    const constants = DualScreenInfoNative.getConstants();
    const emitter = getEventEmitter();
    emitter.removeAllListeners(constants.EVENT_DID_UPDATE_SPANNING);
  } catch (error) {
    console.warn('DualScreenInfo.removeAllSpanningListeners error:', error);
  }
}

/**
 * Hook to use dual screen info in React components
 */
export { useDualScreenInfo } from './useDualScreenInfo';

// Export types
export type { DualScreenInfoNativeModule };

// Default export
const DualScreenInfo = {
  isDualScreenDevice,
  isSpanning,
  getWindowRects,
  getHingeBounds,
  addSpanningListener,
  removeAllSpanningListeners,
};

export default DualScreenInfo;

