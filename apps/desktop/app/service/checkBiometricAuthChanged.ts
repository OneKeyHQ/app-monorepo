import { checkBiometricAuthChanged } from 'electron-check-biometric-auth-changed';

import { ECheckBiometricAuthChangedEventType } from './enum';

// Child process
process.parentPort.on(
  'message',
  (e: {
    data: { type: ECheckBiometricAuthChangedEventType; params: unknown };
  }) => {
    switch (e.data.type) {
      case ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged:
        {
          const result = checkBiometricAuthChanged();
          process.parentPort.postMessage({
            type: ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged,
            result,
          });
        }
        break;
      default:
        break;
    }
  },
);
