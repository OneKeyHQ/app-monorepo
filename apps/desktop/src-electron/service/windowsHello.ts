import windowsSecurityCredentialsUiModule, {
  UserConsentVerificationResult,
  UserConsentVerifierAvailability,
} from 'electron-windows-security';

import { EWindowHelloEventType } from './enum';

function checkWindowsHelloAvailability(callback: (result: boolean) => void) {
  try {
    windowsSecurityCredentialsUiModule.UserConsentVerifier.checkAvailabilityAsync(
      (error, status) => {
        if (error) {
          callback(false);
        } else {
          callback(status === UserConsentVerifierAvailability.available);
        }
      },
    );
  } catch (error) {
    return false;
  }
}

function requestVerificationAsync(
  message: string,
  callback: (params: { success: boolean; error?: string }) => void,
) {
  windowsSecurityCredentialsUiModule.UserConsentVerifier.requestVerificationAsync(
    message,
    (error, status) => {
      if (error) {
        callback({
          success: false,
          error: error.message,
        });
      } else {
        callback({
          success: status === UserConsentVerificationResult.verified,
        });
      }
    },
  );
}

// Child process
process.parentPort.on(
  'message',
  (e: { data: { type: string; params: unknown } }) => {
    switch (e.data.type) {
      case 'checkAvailabilityAsync':
        checkWindowsHelloAvailability((result) => {
          process.parentPort.postMessage({
            type: EWindowHelloEventType.CheckAvailabilityAsync,
            result,
          });
        });
        break;
      case 'requestVerificationAsync':
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
