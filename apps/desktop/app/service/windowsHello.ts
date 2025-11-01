import { Passport, VerificationResult } from 'passport-desktop';

import { EWindowHelloEventType } from './enum';

function checkWindowsHelloAvailability(callback: (result: boolean) => void) {
  try {
    const isAvailable = Passport.available();
    callback(isAvailable);
  } catch (error) {
    callback(false);
  }
}

function requestVerificationAsync(
  message: string,
  callback: (params: { success: boolean; error?: string }) => void,
) {
  void Passport.requestVerification(message).then((verification) => {
    if (verification === VerificationResult.Verified) {
      callback({
        success: true,
      });
    } else {
      callback({
        error: '',
        success: false,
      });
    }
  });
}

// Child process
process.parentPort.on(
  'message',
  (e: { data: { type: EWindowHelloEventType; params: unknown } }) => {
    switch (e.data.type) {
      case EWindowHelloEventType.CheckAvailabilityAsync:
        checkWindowsHelloAvailability((result) => {
          process.parentPort.postMessage({
            type: EWindowHelloEventType.CheckAvailabilityAsync,
            result,
          });
        });
        break;
      case EWindowHelloEventType.RequestVerificationAsync:
        requestVerificationAsync(e.data.params as string, (result) => {
          process.parentPort.postMessage({
            type: EWindowHelloEventType.RequestVerificationAsync,
            result,
          });
        });
        break;
      default:
        break;
    }
  },
);
