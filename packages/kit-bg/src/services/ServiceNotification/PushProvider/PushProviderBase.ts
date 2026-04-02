import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { NotificationEventEmitter } from '../NotificationEventEmitter';

export type IPushProviderBaseProps = {
  eventEmitter: NotificationEventEmitter;
  instanceId: string;
  backgroundApi: IBackgroundApi;
};
export class PushProviderBase {
  constructor({
    eventEmitter,
    instanceId,
    backgroundApi,
  }: IPushProviderBaseProps) {
    this.eventEmitter = eventEmitter;
    this.instanceId = instanceId;
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  eventEmitter: NotificationEventEmitter;

  instanceId: string;
}
