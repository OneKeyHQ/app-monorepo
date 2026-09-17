import { installFunctionTrace } from '..';

type IFunctionTraceMeta = {
  name: string;
  file: string;
  line?: number;
};

type IFunctionTraceHooks = {
  start: (meta: IFunctionTraceMeta) => unknown;
  end: (token: unknown) => void;
};

type IFunctionTraceTestGlobal = typeof globalThis & {
  __ONEKEY_FUNCTION_TRACE__?: unknown;
  __ONEKEY_RUNTIME_KIND__?: string;
  __onekeyFunctionTraceStart?: IFunctionTraceHooks['start'];
  __onekeyFunctionTraceEnd?: IFunctionTraceHooks['end'];
};

const mockLogLevel = { Debug: 0, Info: 1, Warning: 2, Error: 3 } as const;
const mockNativeLoggerWrite = jest.fn<void, [number, string]>();

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: mockLogLevel,
    NativeLogger: {
      write: (level: number, message: string) =>
        mockNativeLoggerWrite(level, message),
    },
  }),
);

const testGlobal = globalThis as IFunctionTraceTestGlobal;

function installHooks(): IFunctionTraceHooks {
  installFunctionTrace();
  const start = testGlobal.__onekeyFunctionTraceStart;
  const end = testGlobal.__onekeyFunctionTraceEnd;
  if (typeof start !== 'function' || typeof end !== 'function') {
    throw new TypeError('function trace hooks were not installed');
  }
  return { start, end };
}

beforeEach(() => {
  mockNativeLoggerWrite.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete testGlobal.__ONEKEY_FUNCTION_TRACE__;
  delete testGlobal.__ONEKEY_RUNTIME_KIND__;
  delete testGlobal.__onekeyFunctionTraceStart;
  delete testGlobal.__onekeyFunctionTraceEnd;
});

describe('installFunctionTrace', () => {
  it('installs no hooks unless the function trace flag is exactly true', () => {
    for (const flag of [undefined, false, 'true', 1]) {
      testGlobal.__ONEKEY_FUNCTION_TRACE__ = flag;
      installFunctionTrace();
      expect(testGlobal.__onekeyFunctionTraceStart).toBeUndefined();
      expect(testGlobal.__onekeyFunctionTraceEnd).toBeUndefined();
    }
    expect(mockNativeLoggerWrite).not.toHaveBeenCalled();
  });

  it('writes begin and end lines at error level with a millisecond timestamp', () => {
    testGlobal.__ONEKEY_FUNCTION_TRACE__ = true;
    testGlobal.__ONEKEY_RUNTIME_KIND__ = 'background';
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_123);
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(112.5);
    const hooks = installHooks();

    hooks.end(
      hooks.start({
        name: 'loadWallet',
        file: 'packages/kit/src/wallet.ts',
        line: 12,
      }),
    );

    expect(mockNativeLoggerWrite).toHaveBeenCalledTimes(2);
    const [[beginLevel, beginLine], [endLevel, endLine]] =
      mockNativeLoggerWrite.mock.calls;
    expect(beginLevel).toBe(mockLogLevel.Error);
    expect(endLevel).toBe(mockLogLevel.Error);
    const beginMatch = beginLine.match(
      /^\[FunctionTrace\] begin id=(\d+) ts=1700000000123 runtime=background name=loadWallet file=packages\/kit\/src\/wallet\.ts line=12$/,
    );
    const endMatch = endLine.match(
      /^\[FunctionTrace\] end id=(\d+) ts=1700000000123 runtime=background name=loadWallet file=packages\/kit\/src\/wallet\.ts line=12 durationMs=12\.500$/,
    );
    expect(beginMatch).not.toBeNull();
    expect(endMatch).not.toBeNull();
    expect(endMatch?.[1]).toBe(beginMatch?.[1]);
  });
});
