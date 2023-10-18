export function interceptLogger<T>(
  tc: T,
  logMethod: ({ method, params }: { method: string; params: any[] }) => void,
) {
  const tcProxy = new Proxy(tc as any, {
    get(target, propKey, receiver) {
      if (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        typeof target[propKey] === 'function' &&
        typeof propKey === 'string'
      ) {
        return function (...args: any) {
          logMethod({
            method: propKey,
            params: args,
          });

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return Reflect.apply(target[propKey], target, args);
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Reflect.get(target, propKey, receiver);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return tcProxy as T;
}
