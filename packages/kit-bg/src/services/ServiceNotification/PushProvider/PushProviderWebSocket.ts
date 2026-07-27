import { cloneDeep } from 'lodash';
import { io } from 'socket.io-client';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  INotificationPushMessageAckParams,
  INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';
import {
  ENotificationPushMessageAckAction,
  EPushProviderEventNames,
} from '@onekeyhq/shared/types/notification';
import type { IIdentityExitPlanId } from '@onekeyhq/shared/types/prime/identityExitTypes';
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
import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { INotificationStatusAtomData } from '../../../states/jotai/atoms/notifications';
import type { Socket } from 'socket.io-client';

export class PushProviderWebSocket extends PushProviderBase {
  constructor(props: IPushProviderBaseProps) {
    super(props);
    void this.initWebSocket();
  }

  private socket: Socket | null = null;

  private readonly remoteDeviceLogoutProcessing = new Map<
    string,
    Promise<void>
  >();

  private logRemoteDeviceLogoutFailure(reason: string, error?: unknown): void {
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: error
        ? `${reason}: ${error instanceof Error ? error.message : String(error)}`
        : reason,
    });
  }

  private async acknowledgeRemoteDeviceLogout({
    operationId,
    messageId,
  }: {
    operationId: string;
    messageId: string;
  }): Promise<void> {
    try {
      await this.backgroundApi.serviceNotification.ackNotificationMessage({
        msgId: messageId,
        action: ENotificationPushMessageAckAction.arrived,
      });
      await this.backgroundApi.serviceIdentityExit.markRemoteOneKeyIdLogoutNotificationDelivered(
        {
          operationId,
          messageId,
          delivery: 'acknowledged',
        },
      );
    } catch (error) {
      this.logRemoteDeviceLogoutFailure(
        'WebSocket: remote OneKey ID logout acknowledgement failed',
        error,
      );
    }
  }

  private async processRemoteDeviceLogout({
    operationId,
    planId,
    messageId,
  }: {
    operationId: string;
    planId: IIdentityExitPlanId;
    messageId: string;
  }): Promise<void> {
    const existing = this.remoteDeviceLogoutProcessing.get(messageId);
    if (existing) {
      await existing;
      return;
    }
    const processing = (async () => {
      try {
        const receipt =
          await this.backgroundApi.serviceIdentityExit.executeIdentityExit({
            planId,
          });
        if (receipt.status !== 'completed') {
          this.logRemoteDeviceLogoutFailure(
            `WebSocket: remote OneKey ID logout reconciliation returned ${receipt.status}`,
          );
          return;
        }
        if (receipt.oneKeyIdLoggedOut) {
          appEventBus.emit(EAppEventBusNames.PrimeDeviceLogout, {
            operationId,
            messageId,
          });
        } else {
          await this.backgroundApi.serviceIdentityExit.markRemoteOneKeyIdLogoutNotificationDelivered(
            {
              operationId,
              messageId,
              delivery: 'presentationHandled',
            },
          );
        }
        defaultLogger.notification.websocket.consoleLog(
          'WebSocket reconciled primeDeviceLogout message',
          { msgId: messageId },
        );
      } catch (error) {
        this.logRemoteDeviceLogoutFailure(
          'WebSocket: remote OneKey ID logout reconciliation failed',
          error,
        );
      }
    })();
    this.remoteDeviceLogoutProcessing.set(messageId, processing);
    try {
      await processing;
    } finally {
      if (this.remoteDeviceLogoutProcessing.get(messageId) === processing) {
        this.remoteDeviceLogoutProcessing.delete(messageId);
      }
    }
  }

  private async flushPendingRemoteDeviceLogouts(): Promise<void> {
    try {
      const pending =
        await this.backgroundApi.serviceIdentityExit.getPendingRemoteOneKeyIdLogoutNotifications();
      await Promise.all(
        pending.map(async (entry) => {
          if (entry.needsAcknowledgement) {
            await this.acknowledgeRemoteDeviceLogout(entry);
          }
          if (entry.needsPresentation) {
            await this.processRemoteDeviceLogout(entry);
          }
        }),
      );
    } catch (error) {
      this.logRemoteDeviceLogoutFailure(
        'WebSocket: pending remote OneKey ID logout retry failed',
        error,
      );
    }
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
      void this.flushPendingRemoteDeviceLogouts();
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
      async (payload: IPrimeDeviceLogoutInfo) => {
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason:
            'WebSocket: DEVICE_LOGOUT, EAppSocketEventNames.primeDeviceLogout',
        });
        let staged: Awaited<
          ReturnType<
            IBackgroundApi['serviceIdentityExit']['stageRemoteOneKeyIdLogoutNotification']
          >
        >;
        try {
          staged =
            await this.backgroundApi.serviceIdentityExit.stageRemoteOneKeyIdLogoutNotification(
              { messageId: payload.msgId },
            );
        } catch (error) {
          this.logRemoteDeviceLogoutFailure(
            'WebSocket: remote OneKey ID logout durable staging failed',
            error,
          );
          return;
        }
        await this.acknowledgeRemoteDeviceLogout({
          operationId: staged.operationId,
          messageId: payload.msgId,
        });
        if (!staged.presentationHandled) {
          await this.processRemoteDeviceLogout({
            operationId: staged.operationId,
            planId: staged.planId,
            messageId: payload.msgId,
          });
        }
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
