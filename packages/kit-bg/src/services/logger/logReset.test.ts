import { initializeLogResetListener, notifyLogReset } from './logReset.web';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));

describe('Web log reset before lazy logger initialization', () => {
  const original = globalThis.BroadcastChannel;
  const close = jest.fn();
  const postMessage = jest.fn();
  let receive: ((event: { data: unknown }) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      writable: true,
      value: jest.fn(() => ({
        close,
        postMessage,
        set onmessage(value: typeof receive) {
          receive = value;
        },
      })),
    });
  });
  afterEach(() => {
    notifyLogReset();
    globalThis.BroadcastChannel = original;
  });

  it('handles reset before the lazy service is created and does not broadcast it back', () => {
    const initializeAndStop = jest.fn();
    initializeLogResetListener(initializeAndStop);
    expect(initializeAndStop).not.toHaveBeenCalled();
    receive?.({ data: 'unrelated' });
    expect(initializeAndStop).not.toHaveBeenCalled();
    receive?.({ data: 'reset' });
    expect(initializeAndStop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    notifyLogReset();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('broadcasts a local reset only once and releases the channel', () => {
    const onReset = jest.fn();
    initializeLogResetListener(onReset);
    notifyLogReset();
    notifyLogReset();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith('reset');
    expect(close).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();
  });
});
