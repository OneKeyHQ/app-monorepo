import windowsSecurityCredentialsUiModule, {
  UserConsentVerificationResult,
  UserConsentVerifierAvailability,
} from 'electron-windows-security';

async function checkWindowsHelloAvailability(callback) {
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

async function requestWindowsHelloAuth(message, callback) {
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
process.parentPort.on('message', (e) => {
  const [port] = e.ports;
  switch (e.data.type) {
    case 'checkAvailabilityAsync':
      checkWindowsHelloAvailability((result) => {
        port.postMessage({
          type: 'checkAvailabilityAsync',
          result,
        });
      });
      break;
    case 'requestVerificationAsync':
      requestWindowsHelloAuth(e.data.message, (result) => {
        port.postMessage({
          type: 'requestVerificationAsync',
          result,
        });
      });
      break;
    default:
      break;
  }
});
