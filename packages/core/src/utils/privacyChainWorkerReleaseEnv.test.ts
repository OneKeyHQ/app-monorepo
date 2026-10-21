type IReleaseEnvScope = typeof globalThis & {
  __ONEKEY_RELEASE_ENV__?: Record<string, string | undefined>;
};

const scope = globalThis as IReleaseEnvScope;

describe('privacy chain Worker release env', () => {
  afterEach(() => {
    delete scope.__ONEKEY_RELEASE_ENV__;
    jest.resetModules();
  });

  it('defines the release env global a Worker never receives', () => {
    delete scope.__ONEKEY_RELEASE_ENV__;
    jest.isolateModules(() => {
      require('./privacyChainWorkerReleaseEnv');
    });
    expect(scope.__ONEKEY_RELEASE_ENV__).toEqual({});
  });

  it('keeps values a page already loaded', () => {
    scope.__ONEKEY_RELEASE_ENV__ = { VERSION: '6.0.0' };
    jest.isolateModules(() => {
      require('./privacyChainWorkerReleaseEnv');
    });
    expect(scope.__ONEKEY_RELEASE_ENV__).toEqual({ VERSION: '6.0.0' });
  });
});
