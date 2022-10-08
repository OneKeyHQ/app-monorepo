import { Socket, io } from 'socket.io-client';

import { SocketEvents } from '@onekeyhq/engine/src/constants';
import { getSocketEndpoint } from '@onekeyhq/engine/src/endpoint';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { appSelector } from '../../store';
import { backgroundClass, backgroundMethod, bindThis } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceSocket extends ServiceBase {
  private socket: Socket | null = null;

  private interval?: any;

  @backgroundMethod()
  initSocket() {
    const endpoint = getSocketEndpoint();
    debugLogger.notification.info('init websocket', endpoint);
    this.interval = setInterval(() => {
      this.login();
    }, getTimeDurationMs({ minute: 5 }));
    return new Promise((resolve, reject) => {
      this.socket = io(endpoint, {
        transports: ['websocket'],
      });
      const timeout = setTimeout(() => {
        reject(new Error('socket connection failed'));
      }, getTimeDurationMs({ minute: 3 }));
      this.socket.on('connect', () => {
        debugLogger.notification.info('websocket connected');
        this.login();
        clearTimeout(timeout);
        resolve(true);
      });
      this.socket.on('reconnect', () => {
        debugLogger.notification.info('websocket reconnected');
        this.login();
      });
      this.socket.on('disconnect', () => {
        debugLogger.notification.info('websocket disconnected');
      });
    });
  }

  @bindThis()
  @backgroundMethod()
  clear() {
    this.socket?.removeAllListeners?.();
    this.socket?.disconnect?.();
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  @backgroundMethod()
  registerSocketCallback(
    eventName: SocketEvents,
    callback: (...args: any[]) => void,
  ) {
    this.socket?.off(eventName);
    this.socket?.on(eventName, callback);
    debugLogger.notification.info(`register socket callback: ${eventName}`);
  }

  @backgroundMethod()
  login() {
    const instanceId = appSelector((s) => s.settings.instanceId);
    if (!instanceId) {
      return;
    }
    debugLogger.notification.info('websocket login', instanceId);
    this.socket?.emit?.('login', instanceId);
  }
}
