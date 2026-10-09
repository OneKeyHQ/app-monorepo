/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {},
}));

import ServicePromise from './ServicePromise';

describe('ServicePromise callback identity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps higher callback ids stable after an earlier callback settles', () => {
    const service = new ServicePromise({ backgroundApi: {} });
    const resolves = [jest.fn(), jest.fn(), jest.fn()];
    const rejects = [jest.fn(), jest.fn(), jest.fn()];
    const ids = resolves.map((resolve, index) =>
      service.createCallback({
        reject: rejects[index],
        resolve,
      }),
    );

    expect(service.resolveCallbackSync({ id: ids[0], data: 'first' })).toBe(
      true,
    );
    expect(service.hasCallback(ids[1])).toBe(true);
    expect(service.hasCallback(ids[2])).toBe(true);

    expect(service.resolveCallbackSync({ id: ids[2], data: 'third' })).toBe(
      true,
    );
    expect(resolves[2]).toHaveBeenCalledWith('third');
    expect(resolves[1]).not.toHaveBeenCalled();

    expect(service.resolveCallbackSync({ id: ids[1], data: 'second' })).toBe(
      true,
    );
    expect(resolves[1]).toHaveBeenCalledWith('second');
    expect(rejects.every((reject) => reject.mock.calls.length === 0)).toBe(
      true,
    );
  });
});
