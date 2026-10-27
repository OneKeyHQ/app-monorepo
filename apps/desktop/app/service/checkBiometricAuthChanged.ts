import { checkBiometricAuthChanged } from 'electron-check-biometric-auth-changed';

import { ECheckBiometricAuthChangedEventType } from './enum';

// Child process
process.parentPort.on(
  'message',
  (e: {
    data: {
      type: ECheckBiometricAuthChangedEventType;
      params: unknown;
      requestId: number;
    };
  }) => {
    switch (e.data.type) {
      case ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged:
        try {
          const result = checkBiometricAuthChanged();
          process.parentPort.postMessage({
            type: e.data.type,
            requestId: e.data.requestId,
            result,
          });
        } catch {
          process.parentPort.postMessage({
            type: e.data.type,
            requestId: e.data.requestId,
            error: true,
          });
        }
        break;
      default:
        break;
    }
  },
);
