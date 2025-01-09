import type { NotificationEventEmitter } from '../NotificationEventEmitter';

export type IPushProviderBaseProps = {
  eventEmitter: NotificationEventEmitter;
  instanceId: string;
};
export class PushProviderBase {
  constructor({ eventEmitter, instanceId }: IPushProviderBaseProps) {
    this.eventEmitter = eventEmitter;
    this.instanceId = instanceId;
  }

  eventEmitter: NotificationEventEmitter;

  instanceId: string;
}
