export const LAZY_SERVICE_LOCAL_CALL = Symbol.for(
  'onekey.background.lazyServiceLocalCall',
);

type IBackgroundServiceMethod = (...args: unknown[]) => unknown;
type ILazyServiceLocalCall = (
  backgroundMethodName: string,
  methodName: string,
  args: unknown[],
) => unknown;

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
