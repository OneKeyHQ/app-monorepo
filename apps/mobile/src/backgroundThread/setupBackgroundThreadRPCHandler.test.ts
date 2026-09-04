import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { IncorrectPinError } from '@onekeyhq/shared/src/errors/errors/appErrors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const mockSharedRPCWrite = jest.fn();
const mockSharedRPCRegisterReadinessKey = jest.fn();
const mockSharedStoreGet = jest.fn();
const mockSharedStoreSet = jest.fn();
const mockNativeLoggerWrite = jest.fn();

let mockInboundMessageHandler:
  | ((key: string, value: string | number | boolean) => void)
  | undefined;

function dispatchServiceRequest(callId: string) {
  mockInboundMessageHandler?.(
    `onekey:bg:req:${callId}`,
    JSON.stringify({
      type: 'service-call',
      method: 'servicePrime.apiRedeemPrimeCode',
      params: ['OK61451-INVALID-CODE'],
      sync: false,
    }),
  );
}

async function flushRequest() {
  await Promise.resolve();
  await Promise.resolve();
}

function getResponse(callId: string): unknown {
  const responseKey = `onekey:bg:res:${callId}`;
  const responseWrites = mockSharedRPCWrite.mock.calls.filter(
    ([key]) => key === responseKey,
  );
  return JSON.parse(
    responseWrites[responseWrites.length - 1]?.[1] as string,
  ) as unknown;
}

const fallbackResponse = {
  ok: false,
  error: {
    name: 'BackgroundThreadResponseError',
    message: 'Background response failed',
  },
};

jest.mock('@onekeyfe/react-native-background-thread', () => ({
  getSharedRPC: () => ({
    write: mockSharedRPCWrite,
    onWrite: (
      handler: (key: string, value: string | number | boolean) => void,
    ) => {
      mockInboundMessageHandler = handler;
    },
    registerReadinessKey: mockSharedRPCRegisterReadinessKey,
  }),
  getSharedStore: () => ({
    get: mockSharedStoreGet,
    set: mockSharedStoreSet,
  }),
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: class MockOneKeyLocalError extends Error {},
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: {
    dispatchInboundFromForeground: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      eventBus: {
        missingOriginNodeId: jest.fn(),
      },
    },
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Error: 'error', Info: 'info' },
    NativeLogger: { write: mockNativeLoggerWrite },
  }),
);

describe('background thread RPC handler', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('writes a minimal error response when the original error is not serializable', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    const error = new OneKeyLocalError('Original error') as Error & {
      payload?: unknown;
    };
    error.payload = { value: 1n };
    setBackgroundThreadRequestExecutor(() => Promise.reject(error));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('1');
    await flushRequest();

    expect(getResponse('1')).toEqual(fallbackResponse);
  });

  it('writes a minimal error response when reading error metadata fails', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    const error = new OneKeyLocalError('Original error');
    Object.defineProperty(error, 'message', {
      get: () => {
        throw new OneKeyLocalError('Message getter failed');
      },
    });
    setBackgroundThreadRequestExecutor(() => Promise.reject(error));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('2');
    await flushRequest();

    expect(getResponse('2')).toEqual(fallbackResponse);
  });

  it('serializes i18n error metadata with the shared plain-error contract', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    const error = Object.assign(
      new IncorrectPinError({
        message: 'Incorrect PIN entered',
        info: { guessesRemaining: 4 },
      }),
      { reconnect: false },
    );
    setBackgroundThreadRequestExecutor(() => Promise.reject(error));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('info');
    await flushRequest();

    const response = getResponse('info');
    expect(response).toMatchObject({
      ok: false,
      error: {
        name: 'IncorrectPinError',
        message: 'Incorrect PIN entered',
        className: 'IncorrectPinError',
        key: ETranslations.incorrect_pin,
        info: { guessesRemaining: 4 },
        reconnect: false,
      },
    });
    expect(response).not.toHaveProperty('error.stack');
  });

  it('serializes a nullish rejection without falling back', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    // Third-party and native APIs can reject without an Error object.
    // oxlint-disable-next-line prefer-promise-reject-errors
    setBackgroundThreadRequestExecutor(() => Promise.reject(undefined));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('undefined-error');
    await flushRequest();

    expect(getResponse('undefined-error')).toEqual({
      ok: false,
      error: {
        name: 'UnknownEmptyError',
        message: 'Unknown empty error',
      },
    });
  });

  it('retries a failed response write with the minimal error response', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    setBackgroundThreadRequestExecutor(() => Promise.resolve({ value: 1 }));
    mockSharedRPCWrite.mockClear();
    mockSharedRPCWrite.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Native write failed');
    });

    dispatchServiceRequest('3');
    await flushRequest();

    expect(getResponse('3')).toEqual(fallbackResponse);
  });
});
