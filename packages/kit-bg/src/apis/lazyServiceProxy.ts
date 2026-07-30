import { throwMethodNotFound } from '@onekeyhq/shared/src/background/backgroundUtils';

export const LAZY_SERVICE_LOCAL_CALL = Symbol.for(
  'onekey.background.lazyServiceLocalCall',
);

type IBackgroundServiceMethod = (...args: unknown[]) => unknown;
type ILazyServiceLocalCall = (
  backgroundMethodName: string,
  methodName: string,
  args: unknown[],
) => unknown;
type ILazyServiceProxy<
  TService extends object,
  TImmediateMembers extends object,
> = keyof TImmediateMembers extends never
  ? TService
  : Omit<TService, keyof TImmediateMembers> & TImmediateMembers;

export function createLazyServiceProxy<
  T extends object,
  TImmediateMembers extends object = Record<never, never>,
>({
  serviceName,
  loader,
  createImmediateMembers,
}: {
  serviceName: string;
  loader: () => Promise<T>;
  createImmediateMembers?: (loadService: () => Promise<T>) => TImmediateMembers;
}): ILazyServiceProxy<T, TImmediateMembers> {
  let servicePromise: Promise<T> | undefined;
  const loadService = () => {
    servicePromise ??= loader().catch((error: unknown) => {
      servicePromise = undefined;
      throw error;
    });
    return servicePromise;
  };
  const immediateMembers = createImmediateMembers?.(loadService);

  return new Proxy({} as ILazyServiceProxy<T, TImmediateMembers>, {
    get: (_target, methodName) => {
      if (methodName === LAZY_SERVICE_LOCAL_CALL) {
        return (
          backgroundMethodName: string,
          localMethodName: string,
          args: unknown[],
        ) =>
          loadService().then((loadedService) => {
            const backgroundMethod = Reflect.get(
              loadedService,
              backgroundMethodName,
            ) as unknown;
            const localMethod = Reflect.get(
              loadedService,
              localMethodName,
            ) as unknown;
            if (
              typeof backgroundMethod !== 'function' ||
              typeof localMethod !== 'function'
            ) {
              return throwMethodNotFound(serviceName, backgroundMethodName);
            }
            return Reflect.apply(
              localMethod as (...params: unknown[]) => unknown,
              loadedService,
              args,
            );
          });
      }
      if (
        immediateMembers &&
        Object.prototype.hasOwnProperty.call(immediateMembers, methodName)
      ) {
        return Reflect.get(immediateMembers, methodName);
      }
      if (
        typeof methodName !== 'string' ||
        methodName === 'then' ||
        methodName === 'toJSON' ||
        methodName === 'hasOwnProperty'
      ) {
        return undefined;
      }
      return (...args: unknown[]) =>
        loadService().then((loadedService) => {
          const method = Reflect.get(loadedService, methodName) as unknown;
          if (typeof method !== 'function') {
            return throwMethodNotFound(serviceName, methodName);
          }
          return Reflect.apply(
            method as (...params: unknown[]) => unknown,
            loadedService,
            args,
          );
        });
    },
  });
}

export function getLocalBackgroundServiceMethod({
  serviceApi,
  methodName,
  backgroundMethodName,
}: {
  serviceApi: object;
  methodName: string;
  backgroundMethodName: string;
}): IBackgroundServiceMethod | undefined {
  const lazyServiceLocalCall = Reflect.get(
    serviceApi,
    LAZY_SERVICE_LOCAL_CALL,
  ) as unknown;
  if (typeof lazyServiceLocalCall === 'function') {
    return (...args: unknown[]) =>
      Reflect.apply(lazyServiceLocalCall as ILazyServiceLocalCall, serviceApi, [
        backgroundMethodName,
        methodName,
        args,
      ]);
  }

  const backgroundMethod = Reflect.get(
    serviceApi,
    backgroundMethodName,
  ) as unknown;
  if (typeof backgroundMethod !== 'function') {
    return undefined;
  }

  const method = Reflect.get(serviceApi, methodName) as unknown;
  return typeof method === 'function'
    ? (method as IBackgroundServiceMethod)
    : undefined;
}
