import axios from 'axios';
import fetch from 'cross-fetch';
import RNUUID from 'react-native-uuid';

import type {
  DeviceInfo,
  MigrateData,
  MigrateServiceResp,
} from '@onekeyhq/engine/src/types/migrate';
import { deviceInfo } from '@onekeyhq/kit/src/views/Onboarding/screens/Migration/util';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';
import { HTTPServiceNames } from './ServiceHTTP';

import type { RequestData } from './ServiceHTTP';

enum MigrateAPINames {
  Connect = '/migrate/connect',
  DisConnect = '/migrate/disConnect',
  SendData = '/migrate/send',
  RequestData = '/migrate/data',
}

export enum MigrateNotificationNames {
  ReceiveDataFromClient = 'ReceiveDataFromClient',
  RequestDataFromClient = 'RequestDataFromClient',
  Other = 'Other',
}

export type MigrateNotificationData = {
  type: MigrateNotificationNames;
  data: RequestData;
};

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

  serverUrl?: string;

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
      .get<MigrateServiceResp<DeviceInfo>>(url, { timeout: 5 * 1000 })
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

    const { success } = await fetch(url, {
      method: 'POST',
      body: data,
    })
      .then((result) => {
        if (result.ok) {
          return result.json() as MigrateServiceResp<boolean>;
        }
        return {
          success: false,
        };
      })
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
  isConnectedUUID(uuid: string) {
    if (uuid.length === 0) {
      return false;
    }
    if (this.connectUUID.length > 0 && uuid !== this.connectUUID) {
      return false;
    }
    return true;
  }

  receivedHttpRequest = ({
    type,
    data,
  }: {
    type: string;
    data: RequestData;
  }) => {
    if (type !== HTTPServiceNames.Migrate) {
      return;
    }
    const { requestId, url: urlPath } = data;
    // console.log('type = ', type);
    // console.log('requestId = ', requestId);
    // console.log('urlPath = ', urlPath);
    // console.log('postData = ', postData);
    const { serviceHTTP } = this.backgroundApi;

    const url = new URL(urlPath, 'http://example.com');
    const { pathname: apiName, searchParams } = url;
    const uuid = searchParams.get('uuid') ?? '';

    debugLogger.migrate.info('receivedHttpRequest = ', apiName, uuid);

    if (apiName === MigrateAPINames.Connect) {
      if (!this.isConnectedUUID(uuid)) {
        serviceHTTP.serverRespond({
          requestId,
          respondData: { success: false },
        });
        return;
      }
      this.connectUUID = uuid;
      serviceHTTP.serverRespond({
        requestId,
        respondData: { success: true, data: deviceInfo() },
      });
    } else if (apiName === MigrateAPINames.DisConnect) {
      if (this.isConnectedUUID(uuid)) {
        this.connectUUID = '';
        serviceHTTP.serverRespond({
          requestId,
          respondData: { success: true },
        });
      } else {
        serviceHTTP.serverRespond({
          requestId,
          respondData: { success: false },
        });
      }
    } else if (apiName === MigrateAPINames.SendData) {
      if (!this.isConnectedUUID(uuid)) {
        serviceHTTP.serverRespond({
          requestId,
          respondData: { success: false },
        });
        return;
      }
      appUIEventBus.emit(AppUIEventBusNames.Migrate, {
        type: MigrateNotificationNames.ReceiveDataFromClient,
        data,
      });
    } else if (apiName === MigrateAPINames.RequestData) {
      if (!this.isConnectedUUID(uuid)) {
        serviceHTTP.serverRespond({
          requestId,
          respondData: { success: false },
        });
        return;
      }
      appUIEventBus.emit(AppUIEventBusNames.Migrate, {
        type: MigrateNotificationNames.RequestDataFromClient,
        data,
      });
    } else {
      appUIEventBus.emit(AppUIEventBusNames.Migrate, {
        type: MigrateNotificationNames.Other,
        data,
      });
    }
  };

  @backgroundMethod()
  registerHttpEvents() {
    appEventBus.on(
      AppEventBusNames.HttpServerRequest,
      this.receivedHttpRequest,
    );
  }

  @backgroundMethod()
  unRegisterHttpEvents() {
    appEventBus.removeListener(
      AppEventBusNames.HttpServerRequest,
      this.receivedHttpRequest,
    );
  }
}

export default ServiceMigrate;
