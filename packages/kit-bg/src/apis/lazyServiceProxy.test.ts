import {
  createLazyServiceProxy,
  getLocalBackgroundServiceMethod,
} from './lazyServiceProxy';

class ServiceWithValues {
  storedValue = 'loaded-field';

  get computedValue() {
    return 'loaded-getter';
  }

  async getValue() {
    return `${this.storedValue}:${this.computedValue}`;
  }
}

describe('createLazyServiceProxy', () => {
  test('loads once for concurrent first calls and reuses the same instance', async () => {
    const getFirstValue = jest.fn(async () => 'first');
    const getSecondValue = jest.fn(async () => 'second');
    const service = {
      getFirstValue,
      getSecondValue,
    };
    let resolveLoader: ((value: typeof service) => void) | undefined;
    const loader = jest.fn(
      () =>
        new Promise<typeof service>((resolve) => {
          resolveLoader = resolve;
        }),
    );
    const proxy = createLazyServiceProxy({
      serviceName: 'testService',
      loader,
    });

    const firstResult = proxy.getFirstValue();
    const secondResult = proxy.getSecondValue();

    expect(loader).toHaveBeenCalledTimes(1);
    resolveLoader?.(service);

    await expect(firstResult).resolves.toBe('first');
    await expect(secondResult).resolves.toBe('second');
    await expect(proxy.getFirstValue()).resolves.toBe('first');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(getFirstValue).toHaveBeenCalledTimes(2);
    expect(getSecondValue).toHaveBeenCalledTimes(1);
  });

  test('clears a rejected load so the next call can retry', async () => {
    const getValue = jest.fn(async () => 'loaded');
    const loadError = new Error('load failed');
    const loader = jest
      .fn<Promise<{ getValue: () => Promise<string> }>, []>()
      .mockRejectedValueOnce(loadError)
      .mockResolvedValueOnce({ getValue });
    const proxy = createLazyServiceProxy({
      serviceName: 'retryableService',
      loader,
    });

    await expect(proxy.getValue()).rejects.toBe(loadError);
    await expect(proxy.getValue()).resolves.toBe('loaded');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(getValue).toHaveBeenCalledTimes(1);
  });

  test('keeps the loaded instance when a business method rejects', async () => {
    const businessError = new Error('business failed');
    const fail = jest.fn(async () => {
      throw businessError;
    });
    const loader = jest.fn(async () => ({ fail }));
    const proxy = createLazyServiceProxy({
      serviceName: 'failingBusinessService',
      loader,
    });

    await expect(proxy.fail()).rejects.toBe(businessError);
    await expect(proxy.fail()).rejects.toBe(businessError);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledTimes(2);
  });

  test('calls methods with the loaded instance as this', async () => {
    const service = {
      value: 'bound',
      async getValue() {
        return this.value;
      },
    };
    const proxy = createLazyServiceProxy({
      serviceName: 'boundService',
      loader: async () => service,
    });

    await expect(proxy.getValue()).resolves.toBe('bound');
  });

  test('exposes callable and immediate members without exposing loaded values', async () => {
    const loader = jest.fn(async () => new ServiceWithValues());
    const proxy = createLazyServiceProxy({
      serviceName: 'serviceWithValues',
      loader,
      createImmediateMembers: () => ({
        immediateValue: 'immediate-field',
        get immediateComputedValue() {
          return 'immediate-getter';
        },
      }),
    });

    const exposesStoredValue: 'storedValue' extends keyof typeof proxy
      ? true
      : false = false;
    const exposesComputedValue: 'computedValue' extends keyof typeof proxy
      ? true
      : false = false;
    const exposesGetValue: 'getValue' extends keyof typeof proxy
      ? true
      : false = true;
    const exposesImmediateValue: 'immediateValue' extends keyof typeof proxy
      ? true
      : false = true;
    const exposesImmediateComputedValue: 'immediateComputedValue' extends keyof typeof proxy
      ? true
      : false = true;

    expect(exposesStoredValue).toBe(false);
    expect(exposesComputedValue).toBe(false);
    expect(exposesGetValue).toBe(true);
    expect(exposesImmediateValue).toBe(true);
    expect(exposesImmediateComputedValue).toBe(true);
    expect(proxy.immediateValue).toBe('immediate-field');
    expect(proxy.immediateComputedValue).toBe('immediate-getter');
    expect(loader).not.toHaveBeenCalled();
    await expect(proxy.getValue()).resolves.toBe('loaded-field:loaded-getter');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('keeps rejecting runtime calls to non-callable loaded members', async () => {
    const loader = jest.fn(async () => new ServiceWithValues());
    const proxy = createLazyServiceProxy({
      serviceName: 'serviceWithValues',
      loader,
    });
    const runtimeProxy = proxy as unknown as Record<PropertyKey, unknown>;

    expect(Reflect.has(runtimeProxy, 'storedValue')).toBe(false);
    expect(Reflect.has(runtimeProxy, 'computedValue')).toBe(false);
    expect(loader).not.toHaveBeenCalled();

    const storedValue = Reflect.get(runtimeProxy, 'storedValue');
    const computedValue = Reflect.get(runtimeProxy, 'computedValue');
    expect(typeof storedValue).toBe('function');
    expect(typeof computedValue).toBe('function');
    expect(loader).not.toHaveBeenCalled();

    await expect(
      Reflect.apply(storedValue as (...args: unknown[]) => unknown, proxy, []),
    ).rejects.toThrow(
      'Background method not support (method=serviceWithValues.storedValue)',
    );
    await expect(
      Reflect.apply(
        computedValue as (...args: unknown[]) => unknown,
        proxy,
        [],
      ),
    ).rejects.toThrow(
      'Background method not support (method=serviceWithValues.computedValue)',
    );
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('does not load for inspection properties or behave like a promise', async () => {
    const loader = jest.fn(async () => ({
      getValue: async () => 'loaded',
    }));
    const proxy = createLazyServiceProxy({
      serviceName: 'inspectableService',
      loader,
    }) as unknown as Record<PropertyKey, unknown>;

    expect(proxy.then).toBeUndefined();
    expect(proxy.toJSON).toBeUndefined();
    expect(Reflect.get(proxy, 'hasOwnProperty')).toBeUndefined();
    expect(proxy[Symbol.toStringTag]).toBeUndefined();
    expect(await Promise.resolve(proxy)).toBe(proxy);
    expect(loader).not.toHaveBeenCalled();
  });

  test('returns immediate compatibility members without loading the service', async () => {
    const loader = jest.fn(async () => ({
      getValue: async () => 'loaded',
    }));
    const getCompatibilityValue = jest.fn((value: string) => `compat:${value}`);
    const proxy = createLazyServiceProxy({
      serviceName: 'compatibleService',
      loader,
      createImmediateMembers: () => ({
        getCompatibilityValue,
      }),
    });

    expect(proxy.getCompatibilityValue('value')).toBe('compat:value');
    expect(getCompatibilityValue).toHaveBeenCalledWith('value');
    expect(loader).not.toHaveBeenCalled();
    await expect(proxy.getValue()).resolves.toBe('loaded');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('lets immediate members share the cached loader when needed', async () => {
    const storage = {
      getItem: jest.fn(async (key: string) => `stored:${key}`),
    };
    const service = {
      getValue: jest.fn(async () => 'loaded'),
      storage,
    };
    const loader = jest.fn(async () => service);
    const proxy = createLazyServiceProxy({
      serviceName: 'compatibleStorageService',
      loader,
      createImmediateMembers: (loadService) => ({
        storage: createLazyServiceProxy({
          serviceName: 'compatibleStorageService.storage',
          loader: () =>
            loadService().then((loadedService) => loadedService.storage),
        }),
      }),
    });

    await expect(proxy.storage.getItem('key')).resolves.toBe('stored:key');
    await expect(proxy.getValue()).resolves.toBe('loaded');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('gates local calls with the decorated alias after loading', async () => {
    const allowedMethod = jest.fn(async () => 'allowed');
    const privateMethod = jest.fn(async () => 'private');
    const proxy = createLazyServiceProxy({
      serviceName: 'gatedService',
      loader: async () => ({
        INTERNAL_allowedMethod: async () => undefined,
        allowedMethod,
        privateMethod,
      }),
    });

    const allowedLocalMethod = getLocalBackgroundServiceMethod({
      serviceApi: proxy,
      methodName: 'allowedMethod',
      backgroundMethodName: 'INTERNAL_allowedMethod',
    });
    await expect(
      Reflect.apply(
        allowedLocalMethod as (...args: unknown[]) => unknown,
        proxy,
        [],
      ),
    ).resolves.toBe('allowed');

    const privateLocalMethod = getLocalBackgroundServiceMethod({
      serviceApi: proxy,
      methodName: 'privateMethod',
      backgroundMethodName: 'INTERNAL_privateMethod',
    });
    await expect(
      Reflect.apply(
        privateLocalMethod as (...args: unknown[]) => unknown,
        proxy,
        [],
      ),
    ).rejects.toThrow(
      'Background method not support (method=gatedService.INTERNAL_privateMethod)',
    );
    expect(allowedMethod).toHaveBeenCalledTimes(1);
    expect(privateMethod).not.toHaveBeenCalled();
  });

  test('loads and validates decorated aliases on the remote call path', async () => {
    const decoratedMethod = jest.fn(async () => 'decorated');
    const privateMethod = jest.fn(async () => 'private');
    const proxy = createLazyServiceProxy({
      serviceName: 'remoteService',
      loader: async () => ({
        INTERNAL_allowedMethod: decoratedMethod,
        privateMethod,
      }),
    }) as unknown as {
      INTERNAL_allowedMethod: () => Promise<string>;
      INTERNAL_privateMethod: () => Promise<string>;
    };

    await expect(proxy.INTERNAL_allowedMethod()).resolves.toBe('decorated');
    await expect(proxy.INTERNAL_privateMethod()).rejects.toThrow(
      'Background method not support (method=remoteService.INTERNAL_privateMethod)',
    );
    expect(decoratedMethod).toHaveBeenCalledTimes(1);
    expect(privateMethod).not.toHaveBeenCalled();
  });
});
