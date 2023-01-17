import axios from 'axios';
import { NativeEventEmitter, NativeModules } from 'react-native';
import RNUUID from 'react-native-uuid';

import type {
  DeviceInfo,
  MigrateData,
  MigrateServiceResp,
} from '@onekeyhq/engine/src/types/migrate';
import { setEnabled } from '@onekeyhq/kit/src/store/reducers/httpServer';
import { deviceInfo } from '@onekeyhq/kit/src/views/Onboarding/screens/Migration/util';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceBase from './ServiceBase';

import type { EmitterSubscription } from 'react-native';

enum MigrateAPINames {
  Connect = '/connect',
  DisConnect = '/disConnect',
  SendData = '/send',
  RequestData = '/data',
}

export enum MigrateNotificationNames {
  ReceiveDataFromClient = 'ReceiveDataFromClient',
  RequestDataFromClient = 'RequestDataFromClient',
  Other = 'Other',
}

type RequestData = {
  requestId: string;
  postData?: any; // body
  type: string;
  url: string;
};

export type MigrateNotificationData = {
  type: MigrateNotificationNames;
  data: RequestData;
};

const { HTTPServerManager } = NativeModules;
const HttpServerManagerEmitter = new NativeEventEmitter(HTTPServerManager);

function httpServerEnable() {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    return true;
  }
  return false;
}

function migrateServerPort() {
  if (platformEnv.isNativeIOS) {
    return 20231;
  }
  if (platformEnv.isDesktop) {
    return 20232;
  }
  return 20233;
}

export function checkServerUrl(serverUrl: string) {
  try {
    const tempUrl = new URL(serverUrl.replaceAll(' ', ''));
    return tempUrl.origin;
  } catch (error) {
    return '';
  }
}
export function ServerUrl(serverUrl: string, path: string) {
  let url = serverUrl.replaceAll(' ', '');
  if (!url.startsWith('http://')) {
    url = `http://${url}`;
  }
  url = checkServerUrl(url);
  if (url.length > 0) {
    return new URL(path, url).toString();
  }
  return '';
}

@backgroundClass()
class ServiceMigrate extends ServiceBase {
  private randomUUID = '';

  private connectUUID = '';

  private client = axios.create({
    timeout: 60 * 1000,
  });

  private ensureUUID({ reset }: { reset: boolean }) {
    if (reset) {
      this.randomUUID = RNUUID.v4() as string;
    }
    return this.randomUUID;
  }

  httpServerEnable?: boolean;

  serverUrl?: string;

  @backgroundMethod()
  initServiceMigrate() {
    const { dispatch } = this.backgroundApi;
    const enable = httpServerEnable();
    this.httpServerEnable = enable;
    dispatch(setEnabled(enable));
  }

  @backgroundMethod()
  async connectServer(ipAddress: string) {
    const urlParams = new URLSearchParams({
      deviceInfo: JSON.stringify(deviceInfo()),
      uuid: this.ensureUUID({ reset: true }),
    });

    const url = `${ServerUrl(
      ipAddress,
      MigrateAPINames.Connect,
    )}?${urlParams.toString()}`;
    const { success, data } = await this.client
      .get<MigrateServiceResp<DeviceInfo>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: undefined }));
    if (!success) {
      return undefined;
    }
    return data;
  }

  @backgroundMethod()
  async disConnectServer(ipAddress: string) {
    const urlParams = new URLSearchParams({
      uuid: this.ensureUUID({ reset: false }),
    });

    const url = `${ServerUrl(
      ipAddress,
      MigrateAPINames.DisConnect,
    )}?${urlParams.toString()}`;
    const { success } = await this.client
      .get<MigrateServiceResp<boolean>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false }));
    return success;
  }

  @backgroundMethod()
  async sendDataToServer({
    ipAddress,
    data,
  }: {
    ipAddress: string;
    data: string;
  }) {
    const urlParams = new URLSearchParams({
      uuid: this.ensureUUID({ reset: false }),
    });
    const url = `${ServerUrl(
      ipAddress,
      MigrateAPINames.SendData,
    )}?${urlParams.toString()}`;
    const { success } = await this.client
      .post<MigrateServiceResp<boolean>>(url, data)
      .then((resp) => resp.data)
      .catch(() => ({
        success: false,
      }));
    return success;
  }

  @backgroundMethod()
  async getDataFromServer({ ipAddress }: { ipAddress: string }) {
    const urlParams = new URLSearchParams({
      deviceInfo: JSON.stringify(deviceInfo()),
      uuid: this.ensureUUID({ reset: false }),
    });
    const url = `${ServerUrl(
      ipAddress,
      MigrateAPINames.RequestData,
    )}?${urlParams.toString()}`;

    const { success, data } = await this.client
      .get<MigrateServiceResp<MigrateData>>(url)
      .then((resp) => resp.data)
      .catch(() => ({
        success: false,
        data: undefined,
      }));
    if (success) {
      return data;
    }
  }

  @backgroundMethod()
  async startHttpServer(): Promise<string | undefined> {
    if (!this.httpServerEnable) {
      return Promise.resolve('');
    }
    const port = migrateServerPort();
    if (platformEnv.isNative) {
      return new Promise((resolve) => {
        HTTPServerManager.start(port, 'http_service', (data, success) => {
          if (success) {
            this.listenHttpRequest();
            this.serverUrl = data;
            return resolve(data);
          }
          return resolve('');
        });
      });
    }
    if (platformEnv.isDesktop) {
      return new Promise((resolve) => {
        window.desktopApi.startServer(port, (data, success) => {
          if (success) {
            this.listenHttpRequest();
            this.serverUrl = data;
            return resolve(data);
          }
          return resolve('');
        });
      });
    }
  }

  subscription?: EmitterSubscription;

  @backgroundMethod()
  listenHttpRequest() {
    if (!this.httpServerEnable) {
      return;
    }
    if (platformEnv.isNative) {
      this.subscription = HttpServerManagerEmitter.addListener(
        'httpServerResponseReceived',
        (content) => {
          this.receivedHttpRequest(content);
        },
      );
    }
    if (platformEnv.isDesktop) {
      window.desktopApi.serverListener((content) => {
        this.receivedHttpRequest(content);
      });
    }
  }

  @backgroundMethod()
  isConnectedUUID(uuid: string) {
    if (uuid.length === 0) {
      return false;
    }
    if (this.connectUUID.length > 0 && uuid !== this.connectUUID) {
      return false;
    }
    return true;
  }

  @backgroundMethod()
  receivedHttpRequest(content: RequestData) {
    const { requestId, url: urlPath } = content;
    // console.log('type = ', type);
    // console.log('urlPath = ', urlPath);
    // console.log('postData = ', postData);

    const url = new URL(urlPath, 'http://example.com');
    const { pathname: apiName, searchParams } = url;
    const uuid = searchParams.get('uuid') ?? '';

    debugLogger.migrate.info('receivedHttpRequest = ', apiName, uuid);

    if (apiName === MigrateAPINames.Connect) {
      if (!this.isConnectedUUID(uuid)) {
        this.serverRespond({
          requestId,
          respondData: { success: false },
        });
        return;
      }
      this.connectUUID = uuid;
      this.serverRespond({
        requestId,
        respondData: { success: true, data: deviceInfo() },
      });
    } else if (apiName === MigrateAPINames.DisConnect) {
      if (this.isConnectedUUID(uuid)) {
        this.connectUUID = '';
        this.serverRespond({
          requestId,
          respondData: { success: true },
        });
      } else {
        this.serverRespond({
          requestId,
          respondData: { success: false },
        });
      }
    } else if (apiName === MigrateAPINames.SendData) {
      if (!this.isConnectedUUID(uuid)) {
        this.serverRespond({
          requestId,
          respondData: { success: false },
        });
        return;
      }
      appEventBus.emit(AppEventBusNames.HttpServerRequest, {
        type: MigrateNotificationNames.ReceiveDataFromClient,
        data: content,
      });
    } else if (apiName === MigrateAPINames.RequestData) {
      if (!this.isConnectedUUID(uuid)) {
        this.serverRespond({
          requestId,
          respondData: { success: false },
        });
        return;
      }
      appEventBus.emit(AppEventBusNames.HttpServerRequest, {
        type: MigrateNotificationNames.RequestDataFromClient,
        data: content,
      });
    } else {
      appEventBus.emit(AppEventBusNames.HttpServerRequest, {
        type: MigrateNotificationNames.Other,
        data: content,
      });
    }
  }

  @backgroundMethod()
  serverRespond({
    requestId,
    respondData,
  }: {
    requestId: string;
    respondData: MigrateServiceResp<any>;
  }) {
    if (!this.httpServerEnable) {
      return;
    }
    if (platformEnv.isNative) {
      HTTPServerManager.respond(
        requestId,
        200,
        'application/json',
        JSON.stringify(respondData),
      );
    } else if (platformEnv.isDesktop) {
      window.desktopApi.serverRespond(
        requestId,
        200,
        'application/json',
        JSON.stringify(respondData),
      );
    }
  }

  @backgroundMethod()
  stopHttpServer() {
    this.connectUUID = '';
    if (!this.httpServerEnable) {
      return;
    }
    if (platformEnv.isNative) {
      if (this.subscription) {
        this.subscription.remove();
      }

      HTTPServerManager.stop();
    } else if (platformEnv.isDesktop) {
      window.desktopApi.stopServer();
    }
  }
}

export default ServiceMigrate;
