import {
  Availability,
  VerificationResult,
  checkAvailability,
  requestVerification,
} from 'electron-windows-hello';

import { BIOLOGY_AUTH_ABORTED_ERROR } from '@onekeyhq/shared/types/password';

import { EWindowHelloEventType } from './enum';

async function checkWindowsHelloAvailability(
  callback: (result: boolean, diagnostic?: string) => void,
) {
  try {
    const availability = await checkAvailability();
    callback(
      availability === Availability.Available,
      availability === Availability.Available ? undefined : availability,
    );
  } catch (error) {
    callback(false, error instanceof Error ? error.message : String(error));
  }
}

async function requestVerificationAsync(
  params: { message: string; windowHandle: number[] },
  callback: (
    params: { success: boolean; error?: string },
    diagnostic?: string,
  ) => void,
) {
  try {
    const verification = await requestVerification({
      windowHandle: Buffer.from(params.windowHandle),
      message: params.message,
    });
    if (verification === VerificationResult.Verified) {
      callback({ success: true });
    } else {
      callback(
        {
          success: false,
          error:
            verification === VerificationResult.Canceled ? 'user_cancel' : '',
        },
        verification === VerificationResult.Canceled ? undefined : verification,
      );
    }
  } catch (error) {
    callback(
      { success: false, error: BIOLOGY_AUTH_ABORTED_ERROR },
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Child process
process.parentPort.on(
  'message',
  (e: {
    data: {
      type: EWindowHelloEventType;
      params: unknown;
      requestId: string;
    };
  }) => {
    switch (e.data.type) {
      case EWindowHelloEventType.CheckAvailabilityAsync:
        void checkWindowsHelloAvailability((result, diagnostic) => {
          process.parentPort.postMessage({
            type: EWindowHelloEventType.CheckAvailabilityAsync,
            result,
            diagnostic,
          });
        });
        break;
      case EWindowHelloEventType.RequestVerificationAsync:
        void requestVerificationAsync(
          e.data.params as { message: string; windowHandle: number[] },
          (result, diagnostic) => {
            process.parentPort.postMessage({
              type: EWindowHelloEventType.RequestVerificationAsync,
              requestId: e.data.requestId,
              result,
              diagnostic,
            });
          },
        );
        break;
      default:
        break;
    }
  },
);
