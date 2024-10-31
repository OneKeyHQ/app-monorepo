import windowsSecurityCredentialsUiModule, {
  UserConsentVerificationResult,
  UserConsentVerifierAvailability,
} from 'electron-windows-security';

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

function requestWindowsHelloAuth(
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
  (e: { data: { type: string; message: string } }) => {
    switch (e.data.type) {
      case 'checkAvailabilityAsync':
        checkWindowsHelloAvailability((result) => {
          process.parentPort.postMessage({
            type: 'checkAvailabilityAsync',
            result,
          });
        });
        break;
      case 'requestVerificationAsync':
        requestWindowsHelloAuth(e.data.message, (result) => {
          process.parentPort.postMessage({
            type: 'requestVerificationAsync',
            result,
          });
        });
        break;
      default:
        break;
    }
  },
);
