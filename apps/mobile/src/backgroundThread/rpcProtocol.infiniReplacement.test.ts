import { shouldCloseReplaceTxOnError } from '@onekeyhq/kit/src/views/Send/pages/SendReplaceTx/replaceTxErrorUtils';
import {
  InfiniReplacementExpiredError,
  InfiniReplacementUnavailableError,
} from '@onekeyhq/shared/src/errors';

import {
  buildBackgroundThreadErrorResponse,
  parseBackgroundThreadResponse,
  serializeBackgroundThreadResponse,
} from './rpcProtocol';

describe('Infini replacement errors across native RPC', () => {
  it.each([
    new InfiniReplacementExpiredError({
      autoToast: true,
      data: { paymentValidationFailure: 'quoteExpired' },
    }),
    new InfiniReplacementUnavailableError(),
  ])('preserves terminal identity for $className', (error) => {
    const response = parseBackgroundThreadResponse(
      serializeBackgroundThreadResponse(
        buildBackgroundThreadErrorResponse(error),
      ),
    );
    expect(response?.error).toMatchObject({
      className: error.className,
      autoToast: true,
      message: error.message,
    });
    // Native RPC deliberately drops arbitrary data; dismissal must not rely on it.
    expect(response?.error?.data).toBeUndefined();
    expect(shouldCloseReplaceTxOnError(response?.error)).toBe(true);
  });
});
