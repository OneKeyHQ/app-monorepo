import { NativeEventEmitter, NativeModules } from 'react-native';

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

export type RequestData = {
  requestId: string;
  postData?: any; // body
  type: string;
  url: string;
};

export enum HTTPServiceNames {
  Migrate = '/migrate',
  Other = 'Other',
}

const { HTTPServerManager } = NativeModules;
const HttpServerManagerEmitter = new NativeEventEmitter(HTTPServerManager);

export function httpServerEnable() {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    return true;
  }
  return false;
}

function serverPort() {
  if (platformEnv.isNativeIOS) {
    return 20231;
  }
  if (platformEnv.isDesktop) {
    return 20232;
  }
  return 20233;
}

@backgroundClass()
class ServiceHTTP extends ServiceBase {
  get httpServerEnable() {
    return httpServerEnable();
  }

  serverUrl?: string;

  @backgroundMethod()
  async startHttpServer(): Promise<string | undefined> {
    if (!this.httpServerEnable) {
      return Promise.resolve('');
    }
    const port = serverPort();
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

  subscription?: EmitterSubscription | null;

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
  receivedHttpRequest(content: RequestData) {
    const { requestId, url: urlPath } = content;

    const url = new URL(urlPath, 'http://example.com');
    const { pathname: apiName } = url;

    if (apiName.startsWith(HTTPServiceNames.Migrate)) {
      appEventBus.emit(AppEventBusNames.HttpServerRequest, {
        type: HTTPServiceNames.Migrate,
        data: content,
      });
    } else {
      this.serverRespond({ requestId, respondData: true });
    }
  }

  @backgroundMethod()
  serverRespond({
    requestId,
    respondData,
  }: {
    requestId: string;
    respondData: any;
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
    if (!this.httpServerEnable) {
      return;
    }

    try {
      if (platformEnv.isNative) {
        if (this.subscription) {
          this.subscription.remove();
          this.subscription = null;
        }

        HTTPServerManager.stop();
      } else if (platformEnv.isDesktop) {
        window.desktopApi.stopServer();
      }
    } catch (error) {
      debugLogger.migrate.error('stopHttpServer', error);
    }
  }
}

export default ServiceHTTP;
