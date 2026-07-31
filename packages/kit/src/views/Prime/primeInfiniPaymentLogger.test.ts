import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  getPrimeInfiniPaymentLocalError,
  getPrimeInfiniPaymentSafeError,
  logPrimeInfiniPaymentFlow,
  logPrimeInfiniPaymentMonitorEvent,
} from './primeInfiniPaymentLogger';

describe('getPrimeInfiniPaymentSafeError', () => {
  it('keeps diagnostic identifiers without leaking messages or payloads', () => {
    const error = Object.assign(new Error('account 0x1234 failed'), {
      code: 4001,
      requestId: 'request-1',
      httpStatusCode: 503,
      data: {
        address: '0x1234',
      },
    });

    expect(getPrimeInfiniPaymentSafeError(error)).toEqual({
      errorName: 'Error',
      errorCode: '4001',
      requestId: 'request-1',
      httpStatusCode: 503,
    });
  });

  it('normalizes empty and non-primitive metadata', () => {
    expect(
      getPrimeInfiniPaymentSafeError({
        name: '',
        code: { nested: true },
        requestId: 123,
        httpStatusCode: Number.NaN,
      }),
    ).toEqual({
      errorName: undefined,
      errorCode: undefined,
      requestId: '123',
      httpStatusCode: undefined,
    });
  });

  it('reads a safe HTTP status from an Axios-style response', () => {
    expect(
      getPrimeInfiniPaymentSafeError({
        name: 'AxiosError',
        response: {
          status: 429,
          data: {
            token: 'must-not-be-logged',
          },
        },
      }),
    ).toEqual({
      errorName: 'AxiosError',
      errorCode: undefined,
      requestId: undefined,
      httpStatusCode: 429,
    });
  });
});

describe('getPrimeInfiniPaymentLocalError', () => {
  it('keeps the original diagnostic message while scrubbing secrets', () => {
    const error = Object.assign(
      new Error('payment failed for user@example.com with token=secret-token'),
      {
        code: 'payment_rejected',
        requestId: 'request-1',
      },
    );

    expect(getPrimeInfiniPaymentLocalError(error)).toEqual({
      errorName: 'Error',
      errorCode: 'payment_rejected',
      requestId: 'request-1',
      httpStatusCode: undefined,
      errorMessage: 'payment failed for [email] with token=[redacted]',
    });
  });

  it('normalizes primitive throwables into a useful local message', () => {
    expect(getPrimeInfiniPaymentLocalError('payment unavailable')).toEqual({
      errorName: 'StringError',
      errorCode: undefined,
      requestId: undefined,
      httpStatusCode: undefined,
      errorMessage: 'payment unavailable',
    });
  });

  it('leaves a missing message available for the UI fallback', () => {
    expect(getPrimeInfiniPaymentLocalError({})).toEqual({
      errorName: 'UnknownError',
      errorCode: undefined,
      requestId: undefined,
      httpStatusCode: undefined,
      errorMessage: undefined,
    });
  });

  it('writes the scrubbed original error to the local defaultLogger scene', () => {
    const localErrorLog = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentError')
      .mockImplementation((params) => params);
    const flowLog = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentFlow')
      .mockImplementation((params) => params);

    logPrimeInfiniPaymentFlow({
      stage: 'paymentReplacement',
      status: 'failed',
      reason: 'accountReplacementFailed',
      error: new Error('identity changed for user@example.com'),
    });

    expect(flowLog).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'paymentReplacement',
        status: 'failed',
        errorName: 'Error',
      }),
    );
    expect(localErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'paymentReplacement',
        status: 'failed',
        errorMessage: 'identity changed for [email]',
      }),
    );

    localErrorLog.mockRestore();
    flowLog.mockRestore();
  });

  it('keeps an unknown diagnostic message in the local logger only', () => {
    const localErrorLog = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentError')
      .mockImplementation((params) => params);
    const flowLog = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentFlow')
      .mockImplementation((params) => params);

    logPrimeInfiniPaymentFlow({
      stage: 'paymentContext',
      status: 'failed',
      reason: 'paymentActionRejected',
      error: {},
    });

    expect(localErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'Unknown payment error',
      }),
    );

    localErrorLog.mockRestore();
    flowLog.mockRestore();
  });
});

describe('logPrimeInfiniPaymentMonitorEvent', () => {
  it('records every failed request from one polling cycle', () => {
    const localErrorLog = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentError')
      .mockImplementation((params) => params);
    const flowLog = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentFlow')
      .mockImplementation((params) => params);
    const paymentError = new Error('payment endpoint failed');
    const purchaseStatusError = new Error('purchase status failed');

    logPrimeInfiniPaymentMonitorEvent({
      event: {
        type: 'failed',
        data: undefined,
        retryCount: 1,
        issue: {
          reason: 'paymentUnavailableOrSnapshotMismatch',
          error: paymentError,
          relatedIssues: [
            {
              reason: 'purchaseStatusUnavailable',
              error: purchaseStatusError,
            },
          ],
        },
      },
      context: {
        stage: 'paymentPolling',
        checkoutType: 'internalWallet',
      },
    });

    expect(localErrorLog).toHaveBeenCalledTimes(2);
    expect(localErrorLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        reason: 'paymentUnavailableOrSnapshotMismatch',
        errorMessage: 'payment endpoint failed',
      }),
    );
    expect(localErrorLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        reason: 'purchaseStatusUnavailable',
        errorMessage: 'purchase status failed',
      }),
    );

    localErrorLog.mockRestore();
    flowLog.mockRestore();
  });
});
