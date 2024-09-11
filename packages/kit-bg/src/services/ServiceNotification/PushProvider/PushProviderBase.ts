import type { NotificationEventEmitter } from '../NotificationEventEmitter';

export type IPushProviderBaseProps = {
  eventEmitter: NotificationEventEmitter;
};
export class PushProviderBase {
  constructor({ eventEmitter }: IPushProviderBaseProps) {
    this.eventEmitter = eventEmitter;
  }

  eventEmitter: NotificationEventEmitter;
}
