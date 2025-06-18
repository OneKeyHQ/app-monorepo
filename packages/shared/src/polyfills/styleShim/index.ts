import { StyleSheet } from 'react-native';

// Create a custom hairlineWidth since StyleSheet.hairlineWidth is read-only
// Browser minimum support is 0.5px for hairline width
const hairlineWidth = 0.5;

// Override the StyleSheet object with our custom hairlineWidth
if (StyleSheet && StyleSheet.hairlineWidth) {
  Object.defineProperty(StyleSheet, 'hairlineWidth', {
    value: hairlineWidth,
    writable: false,
    enumerable: true,
    configurable: true,
  });
}
