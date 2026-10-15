import Logger from 'electron-log/main';
import {
  Availability,
  VerificationResult,
  checkAvailability,
  requestVerification,
} from 'electron-windows-hello';

import { EWindowHelloEventType } from './enum';

async function checkWindowsHelloAvailability(
  callback: (result: boolean) => void,
) {
  try {
    callback((await checkAvailability()) === Availability.Available);
  } catch (error) {
    Logger.info('Windows Hello availability failed', error);
    callback(false);
  }
}

async function requestVerificationAsync(
  params: { message: string; windowHandle: number[] },
  callback: (params: { success: boolean; error?: string }) => void,
) {
  try {
    const verification = await requestVerification({
      windowHandle: Buffer.from(params.windowHandle),
      message: params.message,
    });
    if (verification === VerificationResult.Verified) {
      callback({ success: true });
    } else {
      if (verification !== VerificationResult.Canceled) {
        Logger.info('Windows Hello verification failed', verification);
      }
      callback({
        success: false,
        error:
          verification === VerificationResult.Canceled ? 'user_cancel' : '',
      });
    }
  } catch (error) {
    Logger.info('Windows Hello verification failed', error);
    callback({
      success: false,
      error: '',
    });
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
        void checkWindowsHelloAvailability((result) => {
          process.parentPort.postMessage({
            type: EWindowHelloEventType.CheckAvailabilityAsync,
            result,
          });
        });
        break;
      case EWindowHelloEventType.RequestVerificationAsync:
        void requestVerificationAsync(
          e.data.params as { message: string; windowHandle: number[] },
          (result) => {
            process.parentPort.postMessage({
              type: EWindowHelloEventType.RequestVerificationAsync,
              requestId: e.data.requestId,
              result,
            });
          },
        );
        break;
      default:
        break;
    }
  },
);
