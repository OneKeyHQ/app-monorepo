import { io } from 'socket.io-client';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  INotificationPushMessageAckParams,
  INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';
import { EPushProviderEventNames } from '@onekeyhq/shared/types/notification';

import { getEndpointInfo } from '../../../endpoints';

import { PushProviderBase } from './PushProviderBase';

import type { IPushProviderBaseProps } from './PushProviderBase';
import type { Socket } from 'socket.io-client';

export class PushProviderWebSocket extends PushProviderBase {
  constructor(props: IPushProviderBaseProps) {
    super(props);
    void this.initWebSocket();
  }

  private socket: Socket | null = null;

  async ackMessage(params: INotificationPushMessageAckParams) {
    const { msgId, action } = params;
    if (this.socket && msgId && action) {
      const r = await this.socket
        .timeout(3000)
        .emitWithAck('ack', { msgId, action });
      return r as { updated: number };
    }
    return null;
  }

  private async initWebSocket() {
    // const endpoint = 'http://localhost:4982';
    const endpointInfo = await getEndpointInfo({
      name: EServiceEndpointEnum.NotificationWebSocket,
    });
    const endpoint = endpointInfo.endpoint;
    defaultLogger.notification.websocket.consoleLog(
      'PushProviderWebSocket endpoint',
      endpoint,
    );
    // TODO init timeout
    this.socket = io(endpoint, {
      transports: ['websocket'],
    });
    this.socket.on('connect', () => {
      // 获取 socketId
      defaultLogger.notification.websocket.consoleLog(
        'WebSocket 连接成功',
        this.socket?.id,
      );
      this.eventEmitter.emit(EPushProviderEventNames.ws_connected, {
        socketId: this.socket?.id,
        socket: this.socket,
      });
    });
    this.socket.on('connect_error', (error) => {
      defaultLogger.notification.websocket.consoleLog(
        'WebSocket 连接错误:',
        error,
      );
    });
    this.socket.on('error', (error) => {
      defaultLogger.notification.websocket.consoleLog('WebSocket 错误:', error);
    });
    this.socket.on('reconnect', (payload) => {
      defaultLogger.notification.websocket.consoleLog('WebSocket 重新连接成功');
    });
    this.socket.on('disconnect', (reason) => {
      defaultLogger.notification.websocket.consoleLog(
        'WebSocket 连接断开',
        reason,
      );
    });

    this.socket.on('notification', (message: INotificationPushMessageInfo) => {
      defaultLogger.notification.websocket.consoleLog(
        'WebSocket 收到 notification 消息:',
        message,
      );
      this.eventEmitter.emit(EPushProviderEventNames.notification_received, {
        ...message,
        pushSource: 'websocket',
      });
    });
    defaultLogger.notification.websocket.consoleLog('WebSocket 初始化完成');

    // this.socket.off('notification');
  }
}
