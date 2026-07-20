import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import ServiceBootstrap, {
  createHomeRuntimeProducerInstanceId,
} from './ServiceBootstrap';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass:
    () =>
    <T extends abstract new (...args: never[]) => unknown>(constructor: T) =>
      constructor,
  backgroundMethod:
    () =>
    (_target: object, _methodName: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: object, _methodName: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({}));

jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: { startServerTimeInterval: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      bootstrap: {
        initCriticalStep: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: false, isExtension: false, isWeb: false },
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: { readyDb: Promise.resolve() },
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class MockServiceBase {
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    backgroundApi: unknown;
  },
}));

describe('ServiceBootstrap Home runtime handshake', () => {
  it('returns one immutable producer identity for the current bg boot', async () => {
    const first = new ServiceBootstrap({ backgroundApi: {} });
    const second = new ServiceBootstrap({ backgroundApi: {} });

    await expect(first.getHomeRuntimeHandshake()).resolves.toEqual({
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      producerInstanceId: expect.stringMatching(/^home-bg-/),
    });
    await expect(second.getHomeRuntimeHandshake()).resolves.toEqual(
      await first.getHomeRuntimeHandshake(),
    );
  });

  it('creates a distinct producer identity for a different bg boot', () => {
    expect(createHomeRuntimeProducerInstanceId()).not.toBe(
      createHomeRuntimeProducerInstanceId(),
    );
  });
});
