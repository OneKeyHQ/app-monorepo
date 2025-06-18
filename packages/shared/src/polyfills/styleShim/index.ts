import { StyleSheet } from 'react-native';

// Create a custom hairlineWidth since StyleSheet.hairlineWidth is read-only
const MIN_WIDTH = 0.333;
const hairlineWidth =
  globalThis &&
  'devicePixelRatio' in globalThis &&
  typeof globalThis.devicePixelRatio === 'number'
    ? Math.min(MIN_WIDTH, 1 / globalThis.devicePixelRatio)
    : MIN_WIDTH;

// Override the StyleSheet object with our custom hairlineWidth
if (StyleSheet && StyleSheet.hairlineWidth) {
  Object.defineProperty(StyleSheet, 'hairlineWidth', {
    value: hairlineWidth,
    writable: false,
    enumerable: true,
    configurable: true,
  });
}
