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
    requestId: string;
    method: T;
    args: IAsyncStorageWriteArgsByMethod[T];
  };
}[IAsyncStorageWriteMethod];

export type IAsyncStorageWriteForwarderRequestStatus = {
  requestId: string;
  status: 'pending' | 'executing' | 'committed';
  bootId?: string;
  ts: number;
};

export const ASYNC_STORAGE_WRITE_FORWARDER_STATUS_KEY_PREFIX =
  '@onekey/mobile/async-storage-write-forwarder/request-status/';

export function buildAsyncStorageWriteForwarderStatusKey(requestId: string) {
  return `${ASYNC_STORAGE_WRITE_FORWARDER_STATUS_KEY_PREFIX}${requestId}`;
}

export function serializeAsyncStorageWriteForwarderRequestStatus(
  status: IAsyncStorageWriteForwarderRequestStatus,
) {
  return JSON.stringify(status);
}

export function parseAsyncStorageWriteForwarderRequestStatus(
  value: string | number | boolean | undefined,
): IAsyncStorageWriteForwarderRequestStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const status = JSON.parse(
      value,
    ) as Partial<IAsyncStorageWriteForwarderRequestStatus>;
    if (
      typeof status.requestId !== 'string' ||
      (status.status !== 'pending' &&
        status.status !== 'executing' &&
        status.status !== 'committed') ||
      typeof status.ts !== 'number'
    ) {
      return undefined;
    }
    if (status.bootId !== undefined && typeof status.bootId !== 'string') {
      return undefined;
    }
    return status as IAsyncStorageWriteForwarderRequestStatus;
  } catch {
    return undefined;
  }
}

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
