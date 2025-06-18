import { StyleSheet } from 'react-native';

// Create a custom hairlineWidth since StyleSheet.hairlineWidth is read-only
const hairlineWidth = '0.01875rem';

// Override the StyleSheet object with our custom hairlineWidth
Object.defineProperty(StyleSheet, 'hairlineWidth', {
  value: hairlineWidth,
  writable: false,
  enumerable: true,
  configurable: true,
});
