type IReleaseEnvScope = typeof globalThis & {
  __ONEKEY_RELEASE_ENV__?: Record<string, string | undefined>;
  importScripts?: (...urls: string[]) => void;
};

const scope = globalThis as IReleaseEnvScope;

function load() {
  jest.isolateModules(() => {
    require('./privacyChainWorkerReleaseEnv');
  });
}

describe('privacy chain Worker release env', () => {
  afterEach(() => {
    delete scope.__ONEKEY_RELEASE_ENV__;
    Reflect.deleteProperty(scope, 'importScripts');
    jest.resetModules();
  });

  it('keeps the values a Blob Worker received from the page', () => {
    scope.__ONEKEY_RELEASE_ENV__ = { VERSION: '6.7.0' };
    scope.importScripts = jest.fn();
    load();
    expect(scope.importScripts).not.toHaveBeenCalled();
    expect(scope.__ONEKEY_RELEASE_ENV__).toEqual({ VERSION: '6.7.0' });
  });

  it('falls back to an empty env when nothing provides one', () => {
    load();
    expect(scope.__ONEKEY_RELEASE_ENV__).toEqual({});
  });
});
