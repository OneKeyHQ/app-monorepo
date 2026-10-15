import { OneKeyLocalError } from '../../errors';

import {
  EUpdateErrorCode,
  UPDATE_ERROR_WIRE_PREFIX,
  createUpdateError,
  decodeUpdateErrorWire,
  getUpdateError,
  runUpdateOperation,
} from './error';

const wire = (payload: unknown) =>
  `${UPDATE_ERROR_WIRE_PREFIX}${JSON.stringify(payload)}`;

test('accepts a fixed update error and drops unrecognized fields', () => {
  expect(
    decodeUpdateErrorWire(
      wire({
        code: EUpdateErrorCode.httpError,
        step: 'download',
        httpStatus: 429,
        path: '/Users/private/update.zip',
        stack: 'secret',
      }),
      'download',
    ),
  ).toEqual({
    code: EUpdateErrorCode.httpError,
    step: 'download',
    httpStatus: 429,
  });
});

test('accepts the Nitro Android bridge trailing newline without a stack', () => {
  expect(
    decodeUpdateErrorWire(
      `${wire({ code: EUpdateErrorCode.networkError, step: 'download' })}\n`,
      'download',
    ),
  ).toEqual({ code: EUpdateErrorCode.networkError, step: 'download' });
});

test.each([99, 600, 429.5, '429', null, -1])(
  'drops invalid HTTP status %p',
  (httpStatus) => {
    expect(
      decodeUpdateErrorWire(
        wire({
          code: EUpdateErrorCode.httpError,
          step: 'download',
          httpStatus,
        }),
        'download',
      ),
    ).toEqual({ code: EUpdateErrorCode.httpError, step: 'download' });
  },
);

test('drops an HTTP status on a non-HTTP error', () => {
  expect(
    decodeUpdateErrorWire(
      wire({
        code: EUpdateErrorCode.integrityFailed,
        step: 'verifyASC',
        httpStatus: 500,
      }),
      'verifyASC',
    ),
  ).toEqual({ code: EUpdateErrorCode.integrityFailed, step: 'verifyASC' });
});

test('rejects a wire whose step does not match the public operation', () => {
  expect(
    decodeUpdateErrorWire(
      wire({
        code: EUpdateErrorCode.httpError,
        step: 'downloadASC',
        httpStatus: 403,
      }),
      'download',
    ),
  ).toEqual({ code: EUpdateErrorCode.unknown, step: 'download' });
});

test('rebinds a controlled nested DTO to the public operation', () => {
  expect(
    getUpdateError(
      createUpdateError({
        code: EUpdateErrorCode.httpError,
        step: 'downloadASC',
        httpStatus: 403,
      }),
      'download',
    ),
  ).toEqual({
    code: EUpdateErrorCode.httpError,
    step: 'download',
    httpStatus: 403,
  });
});

test.each([
  'ENOENT /Users/private/update.zip',
  `${UPDATE_ERROR_WIRE_PREFIX}{not json}`,
  wire({ code: 'HTTP_429', step: 'download', httpStatus: 429 }),
  wire({ code: EUpdateErrorCode.httpError, step: 'invalid', httpStatus: 429 }),
  wire(['HTTP_ERROR', 'download', 429]),
])('normalizes malformed payload to UNKNOWN', (message) => {
  expect(decodeUpdateErrorWire(message, 'download')).toEqual({
    code: EUpdateErrorCode.unknown,
    step: 'download',
  });
});

test('keeps OneKeyError numeric code and only a safe DTO in data', () => {
  const error = createUpdateError({
    code: EUpdateErrorCode.packageMissing,
    step: 'verifyPackage',
  });
  expect(typeof error.code).toBe('number');
  expect(error.data).toEqual({
    updateError: {
      code: EUpdateErrorCode.packageMissing,
      step: 'verifyPackage',
    },
  });
  expect(getUpdateError(error, 'verifyPackage')).toEqual({
    code: EUpdateErrorCode.packageMissing,
    step: 'verifyPackage',
  });
});

test('does not read a hostile error getter into the update boundary', () => {
  const error = Object.defineProperty({}, 'message', {
    get: () => {
      throw new OneKeyLocalError('sensitive path');
    },
  });
  expect(getUpdateError(error, 'download')).toEqual({
    code: EUpdateErrorCode.unknown,
    step: 'download',
  });
});

test('does not propagate a raw operation failure across the shared boundary', async () => {
  const raw = new Error('open /Users/private/update.zip?token=secret');
  const rejected = await runUpdateOperation('download', async () => {
    throw raw;
  }).catch((error: unknown) => error);
  expect(getUpdateError(rejected, 'download')).toEqual({
    code: EUpdateErrorCode.unknown,
    step: 'download',
  });
  expect((rejected as Error).message).not.toContain('/Users/private');
  expect((rejected as Error).message).not.toContain('secret');
});
