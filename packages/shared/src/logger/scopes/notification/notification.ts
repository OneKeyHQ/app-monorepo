import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { CommonScene } from './scenes/common';
import { JPushScene } from './scenes/jpush';
import { SupportScene } from './scenes/support';
import { WebSocketScene } from './scenes/websocket';

export class NotificationScope extends BaseScope {
  protected override scopeName = EScopeName.notification;

  common = this.createScene('common', CommonScene);

  jpush = this.createScene('jpush', JPushScene);

  websocket = this.createScene('websocket', WebSocketScene);

  support = this.createScene('support', SupportScene);
}
