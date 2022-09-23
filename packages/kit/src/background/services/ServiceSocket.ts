import { Socket, io } from 'socket.io-client';

import { SocketEvents } from '@onekeyhq/engine/src/constants';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { WEBSOCKET_ENDPOINT } from '../../config';
import { appSelector } from '../../store';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceSocket extends ServiceBase {
  private socket: Socket | null = null;

  @backgroundMethod()
  initSocket() {
    debugLogger.notification.info('init websocket', WEBSOCKET_ENDPOINT);
    return new Promise((resolve) => {
      this.socket = io(WEBSOCKET_ENDPOINT);
      this.socket.on('connect', () => {
        debugLogger.notification.info('websocket connected');
        this.login();
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

  @backgroundMethod()
  registerSocketCallback(
    eventName: SocketEvents,
    callback: (...args: any[]) => void,
  ) {
    this.socket?.off(eventName);
    this.socket?.on(eventName, callback);
  }

  @backgroundMethod()
  login() {
    const instanceId = appSelector((s) => s.settings.instanceId);
    this.socket?.emit('login', instanceId);
  }
}
