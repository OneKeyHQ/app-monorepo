import fs from 'fs';
import path from 'path';
import vm from 'vm';

import ts from 'typescript';

import { OneKeyLocalError } from '../../errors';
import { unwrapElectronIpcError } from '../../errors/utils/electronIpcError';

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

const appSource = ts.createSourceFile(
  'app.ts',
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../apps/desktop/app/app.ts'),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
);
const ipcSafeErrorDeclaration = appSource.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'makeIpcSafeError',
);
if (!ipcSafeErrorDeclaration) {
  throw new OneKeyLocalError('makeIpcSafeError declaration missing');
}
const ipcSafeErrorSource = ts.transpileModule(
  ipcSafeErrorDeclaration.getText(appSource),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

const makeProductionIpcSafeError = (inputError: Error): Error => {
  const result: unknown = vm.runInNewContext(
    `${ipcSafeErrorSource}\nmakeIpcSafeError(inputError, 'DESKTOP_API_CALL failed')`,
    { Error, inputError, UPDATE_ERROR_WIRE_PREFIX },
  );
  if (!(result instanceof Error)) {
    throw new OneKeyLocalError('makeIpcSafeError did not return an Error');
  }
  return result;
};

const invokeError = (error: Error) => {
  const safeError = makeProductionIpcSafeError(error);
  return unwrapElectronIpcError(
    new Error(
      `Error invoking remote method 'DESKTOP_API_CALL': ${safeError.name}: ${safeError.message}`,
    ),
  );
};

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

test.each([
  {
    code: EUpdateErrorCode.httpError,
    step: 'download' as const,
    httpStatus: 401,
  },
  {
    code: EUpdateErrorCode.httpError,
    step: 'download' as const,
    httpStatus: 429,
  },
  { code: EUpdateErrorCode.integrityFailed, step: 'verifyASC' as const },
  { code: EUpdateErrorCode.cancelled, step: 'download' as const },
])('preserves $code through Electron invoke error serialization', (dto) => {
  const mainError = createUpdateError(dto);
  expect(mainError.name).toBe('OneKeyLocalError');
  const rendererError = invokeError(mainError);
  expect(getUpdateError(rendererError, dto.step)).toEqual(dto);
});

test('rebinds a controlled inner step before Electron invoke serialization', () => {
  const mainError = createUpdateError(
    getUpdateError(
      createUpdateError({
        code: EUpdateErrorCode.packageMissing,
        step: 'verifyPackage',
      }),
      'install',
    ),
  );
  const rendererError = invokeError(mainError);
  expect(getUpdateError(rendererError, 'install')).toEqual({
    code: EUpdateErrorCode.packageMissing,
    step: 'install',
  });
  expect(getUpdateError(rendererError, 'verifyPackage')).toEqual({
    code: EUpdateErrorCode.unknown,
    step: 'verifyPackage',
  });
});

test('does not decode arbitrary Electron invoke error text', () => {
  expect(
    makeProductionIpcSafeError(new OneKeyLocalError('ordinary')).name,
  ).toBe('OneKeyLocalError');
  const error = unwrapElectronIpcError(
    new Error(
      "Error invoking remote method 'DESKTOP_API_CALL': OneKeyLocalError: /Users/private/update.zip",
    ),
  );
  expect(getUpdateError(error, 'download')).toEqual({
    code: EUpdateErrorCode.unknown,
    step: 'download',
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
