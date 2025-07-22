import { cloneDeep } from 'lodash';
import { io } from 'socket.io-client';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  INotificationPushMessageAckParams,
  INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';
import {
  ENotificationPushMessageAckAction,
  EPushProviderEventNames,
} from '@onekeyhq/shared/types/notification';
import type {
  IPrimeConfigChangedInfo,
  IPrimeConfigFlushInfo,
  IPrimeDeviceLogoutInfo,
  IPrimeLockChangedInfo,
} from '@onekeyhq/shared/types/socket';
import { EAppSocketEventNames } from '@onekeyhq/shared/types/socket';

import { getEndpointInfo } from '../../../endpoints';
import { notificationStatusAtom } from '../../../states/jotai/atoms/notifications';

import { PushProviderBase } from './PushProviderBase';

import type { IPushProviderBaseProps } from './PushProviderBase';
import type { INotificationStatusAtomData } from '../../../states/jotai/atoms/notifications';
import type { Socket } from 'socket.io-client';

export class PushProviderWebSocket extends PushProviderBase {
  constructor(props: IPushProviderBaseProps) {
    super(props);
    void this.initWebSocket();
  }

  private socket: Socket | null = null;

  async ping(payload: any) {
    return this.socket
      ?.timeout(3000)
      .emitWithAck(EAppSocketEventNames.ping, payload);
  }

  async ackMessage(
    params: INotificationPushMessageAckParams,
  ): Promise<boolean> {
    try {
      const { msgId, action } = params;
      if (this.socket && msgId && action) {
        if (!this.socket.connected) {
          return false;
        }
        const r = await this.socket
          .timeout(3000)
          .emitWithAck(EAppSocketEventNames.ack, { msgId, action });
        return !!r;
      }
      return false;
    } catch (error) {
      defaultLogger.notification.websocket.consoleLog(
        'WebSocket ackMessage error',
        error,
      );
      return false;
    }
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
      auth: {
        instanceId: this.instanceId,
      },
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
      void notificationStatusAtom.set(
        (v): INotificationStatusAtomData => ({
          ...v,
          websocketConnected: true,
        }),
      );
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
    this.socket.on('reconnect', (_payload) => {
      defaultLogger.notification.websocket.consoleLog('WebSocket 重新连接成功');
    });
    this.socket.on('disconnect', (reason) => {
      defaultLogger.notification.websocket.consoleLog(
        'WebSocket 连接断开',
        reason,
      );
      void notificationStatusAtom.set(
        (v): INotificationStatusAtomData => ({
          ...v,
          websocketConnected: false,
        }),
      );
    });

    this.socket.on(EAppSocketEventNames.ping, (payload) => {
      this.socket?.emit(EAppSocketEventNames.pong, payload);
    });

    this.socket.on(
      EAppSocketEventNames.notification,
      (message: INotificationPushMessageInfo) => {
        defaultLogger.notification.websocket.consoleLog(
          'WebSocket 收到 notification 消息:',
          message,
        );
        const data: INotificationPushMessageInfo = cloneDeep(message);
        data.pushSource = 'websocket';
        if (data.extras) {
          data.extras.badge = data?.extras?.badge ?? message?.badge;
        }
        this.eventEmitter.emit(
          EPushProviderEventNames.notification_received,
          data,
        );
      },
    );

    this.socket.on(
      EAppSocketEventNames.primeDeviceLogout,
      (payload: IPrimeDeviceLogoutInfo) => {
        void this.backgroundApi.serviceNotification.ackNotificationMessage({
          msgId: payload.msgId,
          action: ENotificationPushMessageAckAction.arrived,
        });
        appEventBus.emit(EAppEventBusNames.PrimeDeviceLogout, undefined);
        defaultLogger.notification.websocket.consoleLog(
          'WebSocket 收到 primeDeviceLogout 消息:',
          payload,
        );
      },
    );

    this.socket.on(
      EAppSocketEventNames.primeConfigChanged,
      async (payload: IPrimeConfigChangedInfo) => {
        defaultLogger.notification.websocket.consoleLog(
          'WebSocket 收到 primeConfigChanged 消息:',
          payload,
        );
        void this.backgroundApi.serviceNotification.ackNotificationMessage({
          msgId: payload.msgId,
          action: ENotificationPushMessageAckAction.arrived,
        });
        const syncCredential =
          await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();
        await this.backgroundApi.servicePrimeCloudSync.saveServerSyncItemsToLocal(
          {
            serverItems: payload.serverData,
            shouldSyncToScene: true,
            syncCredential,
            serverPwdHash: syncCredential?.masterPasswordUUID || '', // TODO use serverPwdHash
          },
        );
      },
    );

    this.socket.on(
      EAppSocketEventNames.primeLockChanged,
      (payload: IPrimeLockChangedInfo) => {
        defaultLogger.notification.websocket.consoleLog(
          'WebSocket 收到 primeLockChanged 消息:',
          payload,
        );
        void this.backgroundApi.serviceNotification.ackNotificationMessage({
          msgId: payload.msgId,
          action: ENotificationPushMessageAckAction.arrived,
        });
        void this.backgroundApi.servicePrimeCloudSync.onWebSocketMasterPasswordChanged(
          payload,
        );
      },
    );

    this.socket.on(
      EAppSocketEventNames.primeConfigFlush,
      (payload: IPrimeConfigFlushInfo) => {
        defaultLogger.notification.websocket.consoleLog(
          'WebSocket 收到 primeConfigFlush 消息:',
          payload,
        );
        void this.backgroundApi.serviceNotification.ackNotificationMessage({
          msgId: payload.msgId,
          action: ENotificationPushMessageAckAction.arrived,
        });
        void this.backgroundApi.servicePrimeCloudSync.onWebSocketMasterPasswordChanged(
          payload,
        );
      },
    );

    // this.socket.off('notification');
  }

  // Provide access to the socket for other services
  getSocket(): Socket | null {
    return this.socket;
  }
}
