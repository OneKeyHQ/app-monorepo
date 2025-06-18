import { StyleSheet } from 'react-native';

// Create a custom hairlineWidth since StyleSheet.hairlineWidth is read-only
const MIN_WIDTH = 0.333;
const hairlineWidth =
  globalThis &&
  'devicePixelRatio' in globalThis &&
  typeof globalThis.devicePixelRatio === 'number'
    ? MIN_WIDTH
    : Math.min(MIN_WIDTH, 1 / globalThis.devicePixelRatio);

// Override the StyleSheet object with our custom hairlineWidth
Object.defineProperty(StyleSheet, 'hairlineWidth', {
  value: hairlineWidth,
  writable: false,
  enumerable: true,
  configurable: true,
});
