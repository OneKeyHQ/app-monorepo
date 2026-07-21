import { cloneDeep } from 'lodash';
import { io } from 'socket.io-client';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getAvailabilityErrorCode,
  getAvailabilityFailureStatus,
  normalizeAvailabilityErrorCode,
} from '@onekeyhq/shared/src/request/availabilityMetrics';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
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
  ISetBadgeInfo,
  IUserInfoUpdatedPayload,
} from '@onekeyhq/shared/types/socket';
import { EAppSocketEventNames } from '@onekeyhq/shared/types/socket';

import { getEndpointInfo } from '../../../endpoints';
import { notificationStatusAtom } from '../../../states/jotai/atoms/notifications';

import { PushProviderBase } from './PushProviderBase';

import type { IPushProviderBaseProps } from './PushProviderBase';
import type { INotificationStatusAtomData } from '../../../states/jotai/atoms/notifications';
import type { Socket } from 'socket.io-client';

type IConnectionAttempt = {
  attemptId: string;
  startedAt: number;
  trigger: 'initial' | 'reconnect';
};

function normalizeDisconnectReason(reason: Socket.DisconnectReason) {
  if (reason === 'io client disconnect') return 'client_disconnect' as const;
  if (reason === 'io server disconnect') return 'server_disconnect' as const;
  if (reason === 'ping timeout') return 'ping_timeout' as const;
  if (reason === 'transport close') return 'transport_close' as const;
  if (reason === 'transport error') return 'transport_error' as const;
  return 'unknown' as const;
}

export class PushProviderWebSocket extends PushProviderBase {
  constructor(props: IPushProviderBaseProps) {
    super(props);
    void this.initWebSocket();
  }

  private socket: Socket | null = null;

  private connectionAttempt: IConnectionAttempt | null = null;

  private connectedAt: number | null = null;

  private startConnectionAttempt(trigger: IConnectionAttempt['trigger']) {
    const connectionAttempt = {
      attemptId: generateUUID(),
      startedAt: Date.now(),
      trigger,
    };
    this.connectionAttempt = connectionAttempt;
    defaultLogger.app.network.webSocketConnectionAttempt({
      attemptId: connectionAttempt.attemptId,
      transport: 'notification_market',
      trigger,
    });
  }

  private finishConnectionAttempt({
    errorCode,
    status,
  }: {
    errorCode?: unknown;
    status: 'failed' | 'success' | 'timeout';
  }) {
    const connectionAttempt = this.connectionAttempt;
    if (!connectionAttempt) return;
    this.connectionAttempt = null;
    defaultLogger.app.network.webSocketConnectionResult({
      attemptId: connectionAttempt.attemptId,
      durationMs: Math.max(0, Date.now() - connectionAttempt.startedAt),
      errorCode: normalizeAvailabilityErrorCode(errorCode),
      status,
      transport: 'notification_market',
      trigger: connectionAttempt.trigger,
    });
  }

  async ping(payload: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
    const env = endpoint.includes('onekeytest') ? 'test' : 'prod';
    // TODO init timeout
    this.startConnectionAttempt('initial');
    this.socket = io(endpoint, {
      transports: ['websocket', 'polling'],
      extraHeaders: {
        'x-onekey-client-sticky-key': `${platformEnv.appPlatform ?? 'unknown'}:${env}:${this.instanceId}`,
      },
      auth: {
        instanceId: this.instanceId,
      },
      reconnectionDelayMax: 30_000,
    });
    this.socket.on('connect', () => {
      this.finishConnectionAttempt({ status: 'success' });
      this.connectedAt = Date.now();
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
      this.finishConnectionAttempt({
        errorCode: getAvailabilityErrorCode(error),
        status:
          getAvailabilityFailureStatus(error) === 'timeout'
            ? 'timeout'
            : 'failed',
      });
      defaultLogger.notification.websocket.consoleLog(
        'WebSocket 连接错误:',
        error,
      );
    });
    this.socket.on('error', (error) => {
      defaultLogger.notification.websocket.consoleLog('WebSocket 错误:', error);
    });
    this.socket.io.on('reconnect_attempt', () => {
      if (!this.connectionAttempt) {
        this.startConnectionAttempt('reconnect');
      }
    });
    this.socket.io.on('reconnect', (_payload) => {
      defaultLogger.notification.websocket.consoleLog('WebSocket 重新连接成功');
    });
    this.socket.on('disconnect', (reason: Socket.DisconnectReason) => {
      const connectedDurationMs = this.connectedAt
        ? Math.max(0, Date.now() - this.connectedAt)
        : 0;
      this.connectedAt = null;
      defaultLogger.app.network.webSocketConnectionClosed({
        connectedDurationMs,
        reason: normalizeDisconnectReason(reason),
        transport: 'notification_market',
        willReconnect:
          reason !== 'io client disconnect' &&
          reason !== 'io server disconnect',
      });
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
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason:
            'WebSocket: DEVICE_LOGOUT, EAppSocketEventNames.primeDeviceLogout',
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
        if (!payload?.pwdHash) {
          console.error(
            'EAppSocketEventNames.primeConfigChanged ERROR:  payload pwdHash is missing',
            payload,
          );
          return;
        }
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
            serverPwdHash: payload?.pwdHash,
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

    this.socket.on(EAppSocketEventNames.setBadge, (payload: ISetBadgeInfo) => {
      defaultLogger.notification.websocket.consoleLog(
        'WebSocket 收到 setBadge 消息:',
        payload,
      );
      void this.backgroundApi.serviceNotification.ackNotificationMessage({
        msgId: payload.msgId,
        action: ENotificationPushMessageAckAction.arrived,
      });
      void this.backgroundApi.serviceNotification.setBadge({
        count: payload.badge,
      });
    });

    this.socket.on(
      EAppSocketEventNames.userInfoUpdated,
      (payload: IUserInfoUpdatedPayload) => {
        void this.backgroundApi.serviceNotification.ackNotificationMessage({
          msgId: payload.msgId,
          action: ENotificationPushMessageAckAction.arrived,
        });
        void this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();
      },
    );

    // this.socket.off('notification');
  }

  // Provide access to the socket for other services
  getSocket(): Socket | null {
    return this.socket;
  }
}
