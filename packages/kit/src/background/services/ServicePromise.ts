import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

export type PromiseContainerCallbackCreate = {
  resolve: (value: unknown) => void;
  reject: (value: unknown) => void;
  data?: any;
};
export type PromiseContainerCallback = PromiseContainerCallbackCreate & {
  id: number;
  created: number;
};

export type PromiseContainerResolve = {
  id: number | string;
  data?: unknown;
};

export type PromiseContainerReject = {
  id: number | string;
  error?: unknown;
};

let latestId = -1;

@backgroundClass()
class ServicePromise extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    //  this.callbacksExpireTimeout = config.timeout ?? this.callbacksExpireTimeout;
    this._rejectExpiredCallbacks();
  }

  private callbacks: Array<PromiseContainerCallback> = [];

  // TODO increase timeout as hardware sign transaction may take a long time
  //    can set timeout for each callback
  protected callbacksExpireTimeout: number = 10 * 60 * 1000;

  public createCallback({
    resolve,
    reject,
    data,
  }: PromiseContainerCallbackCreate) {
    latestId += 1;
    if (latestId < 0) {
      throw new Error(
        `PromiseContainer ERROR: callback id can NOT negative, id=${latestId}`,
      );
    }
    if (this.callbacks[latestId]) {
      // TODO custom error
      throw new Error(
        `PromiseContainer ERROR: callback exists, id=${latestId}`,
      );
    }
    this.callbacks[latestId] = {
      id: latestId,
      created: Date.now(),
      resolve,
      reject,
      data,
    };
    return latestId;
  }

  @backgroundMethod()
  rejectCallback({ id, error }: PromiseContainerReject) {
    this._processCallback({
      method: 'reject',
      id,
      error,
    });
  }

  @backgroundMethod()
  resolveCallback({ id, data }: PromiseContainerResolve) {
    this._processCallback({
      method: 'resolve',
      id,
      data,
    });
  }

  _processCallback({
    method,
    id,
    data,
    error,
  }: {
    method: 'resolve' | 'reject';
    id: number | string;
    data?: unknown;
    error?: unknown;
  }) {
    const callbackInfo = this.callbacks[id as number];
    if (callbackInfo) {
      if (method === 'reject') {
        if (callbackInfo.reject) {
          callbackInfo.reject(error);
        }
        // this.emit('error', error);
      }
      if (method === 'resolve') {
        if (callbackInfo.resolve) {
          callbackInfo.resolve(data);
        }
      }
      this.removeCallback(id);
    }
  }

  removeCallback(id: number | string) {
    delete this.callbacks[id as number];
  }

  _rejectExpiredCallbacks() {
    if (!this.callbacksExpireTimeout) {
      return;
    }
    const now = Date.now();
    let isCallbacksEmpty = true;
    // eslint-disable-next-line @typescript-eslint/no-for-in-array,guard-for-in,no-restricted-syntax
    for (const id in this.callbacks) {
      isCallbacksEmpty = false;
      const callbackInfo = this.callbacks[id];
      if (callbackInfo && callbackInfo.created) {
        if (now - callbackInfo.created > this.callbacksExpireTimeout) {
          const error = web3Errors.provider.requestTimeout();
          this.rejectCallback({ id, error });
        }
      }
    }
    if (isCallbacksEmpty) {
      this.callbacks = [];
    }
    setTimeout(() => {
      this._rejectExpiredCallbacks();
    }, this.callbacksExpireTimeout);
  }
}

export default ServicePromise;
