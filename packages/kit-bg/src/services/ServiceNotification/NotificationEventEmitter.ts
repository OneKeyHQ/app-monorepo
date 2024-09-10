import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';

import type {
  EPushProviderEventNames,
  IPushProviderEventPayload,
} from '@onekeyhq/shared/types/notification';

export class NotificationEventEmitter extends CrossEventEmitter {
  emitToSelf(type: EPushProviderEventNames, ...args: any[]) {
    super.emit(type, ...args);
    return true;
  }

  override emit<T extends EPushProviderEventNames>(
    type: T,
    payload: IPushProviderEventPayload[T],
  ): boolean {
    this.emitToSelf(type, payload);
    return true;
  }

  override once<T extends EPushProviderEventNames>(
    type: T,
    listener: (payload: IPushProviderEventPayload[T]) => void,
  ) {
    return super.once(type, listener);
  }

  override on<T extends EPushProviderEventNames>(
    type: T,
    listener: (payload: IPushProviderEventPayload[T]) => void,
  ) {
    return super.on(type, listener);
  }

  override off<T extends EPushProviderEventNames>(
    type: T,
    listener: (payload: IPushProviderEventPayload[T]) => void,
  ) {
    return super.off(type, listener);
  }

  override addListener<T extends EPushProviderEventNames>(
    type: T,
    listener: (payload: IPushProviderEventPayload[T]) => void,
  ) {
    return super.addListener(type, listener);
  }

  override removeListener<T extends EPushProviderEventNames>(
    type: T,
    listener: (payload: IPushProviderEventPayload[T]) => void,
  ) {
    return super.removeListener(type, listener);
  }
}
