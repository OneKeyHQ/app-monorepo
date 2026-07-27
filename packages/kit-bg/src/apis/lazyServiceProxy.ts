export const LAZY_SERVICE_PROXY = Symbol.for(
  'onekey.background.lazyServiceProxy',
);

type IBackgroundServiceMethod = (...args: unknown[]) => unknown;

export function getLocalBackgroundServiceMethod({
  serviceApi,
  methodName,
  backgroundMethodName,
}: {
  serviceApi: object;
  methodName: string;
  backgroundMethodName: string;
}): IBackgroundServiceMethod | undefined {
  const backgroundMethod = Reflect.get(
    serviceApi,
    backgroundMethodName,
  ) as unknown;
  if (typeof backgroundMethod !== 'function') {
    return undefined;
  }

  if (Reflect.get(serviceApi, LAZY_SERVICE_PROXY) === true) {
    return backgroundMethod as IBackgroundServiceMethod;
  }

  const method = Reflect.get(serviceApi, methodName) as unknown;
  return typeof method === 'function'
    ? (method as IBackgroundServiceMethod)
    : undefined;
}
