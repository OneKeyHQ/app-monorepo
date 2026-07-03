export type IAsyncStorageWriteArgsByMethod = {
  clear: [];
  multiSet: [[string, string][]];
  multiRemove: [string[]];
  multiMerge: [[string, string][]];
};

export type IAsyncStorageWriteMethod = keyof IAsyncStorageWriteArgsByMethod;

export type IAsyncStorageWriteArgs<
  T extends IAsyncStorageWriteMethod = IAsyncStorageWriteMethod,
> = IAsyncStorageWriteArgsByMethod[T];

export type IAsyncStorageWriteRequest = {
  [T in IAsyncStorageWriteMethod]: {
    method: T;
    args: IAsyncStorageWriteArgsByMethod[T];
  };
}[IAsyncStorageWriteMethod];

export type IAsyncStorageShouldForwardWriteGetter = () => boolean;

export type IAsyncStorageWriteForwarder = <T extends IAsyncStorageWriteMethod>(
  method: T,
  args: IAsyncStorageWriteArgs<T>,
) => Promise<void>;

export type IAsyncStorageWriteForwarderGlobal = typeof globalThis & {
  __onekeyAsyncStorageShouldForwardWriteGetter?: IAsyncStorageShouldForwardWriteGetter;
  __onekeyAsyncStorageWriteForwarder?: IAsyncStorageWriteForwarder;
};

export function getAsyncStorageWriteForwarderGlobal() {
  return globalThis as IAsyncStorageWriteForwarderGlobal;
}
