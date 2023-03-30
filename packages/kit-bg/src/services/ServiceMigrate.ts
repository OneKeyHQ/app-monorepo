import RNUUID from 'react-native-uuid';

import {
  decrypt,
  encrypt,
  generateKeypair,
  rsaDecrypt,
  rsaEncrypt,
} from '@onekeyhq/engine/src/dbs/base';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import type {
  DeviceInfo,
  MigrateData,
  MigrateServiceResp,
} from '@onekeyhq/engine/src/types/migrate';
import { MigrateErrorCode } from '@onekeyhq/engine/src/types/migrate';
import {
  deviceInfo,
  generatePassword,
  parseCloudData,
  randomString,
  shuffle,
} from '@onekeyhq/kit/src/views/Onboarding/screens/Migration/util';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceBase from './ServiceBase';
import { HTTPServiceNames } from './ServiceHTTP';

import type { RequestData } from './ServiceHTTP';
import type { AxiosError } from 'axios';

const RAMDOMNUM_LEAGTH = 4;

enum MigrateAPINames {
  Connect = '/migrate/connect',
  DisConnect = '/migrate/disConnect',
  SendData = '/migrate/send',
  RequestData = '/migrate/data',
}

export enum MigrateNotificationNames {
  ReceiveDataFromClient = 'ReceiveDataFromClient',
  RequestDataFromClient = 'RequestDataFromClient',
  UpdateQrcode = 'UpdateQrcode',
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
  private keypair?: { publicKey: string; privateKey: string };

  private randomNum = '';

  private connectUUID = '';

  // generate by client, use for server
  clientPubKey = '';

  // use for client
  serverPubKey = '';

  private randomUUID = '';

  private ensureUUID({ reset }: { reset: boolean }) {
    if (reset) {
      this.randomUUID = RNUUID.v4() as string;
    }
    return this.randomUUID;
  }

  keyPairProgress = false;

  @backgroundMethod()
  async setupKeypair({ reset }: { reset: boolean }) {
    return new Promise((resolve) => {
      if (reset || this.keypair === undefined) {
        this.keyPairProgress = true;
        this.keypair = generateKeypair();
        debugLogger.migrate.error('keypair setup');
        this.keyPairProgress = false;
      }
      return resolve('');
    });
  }

  @backgroundMethod()
  async encryptDataWithPublicKey(publicKey: string, decryptData: string) {
    if (this.randomNum.length === 0) {
      debugLogger.migrate.error('encryptData error: randomNum is empty');
      return false;
    }
    const password = generatePassword(90);
    const encryptData = encrypt(
      password,
      Buffer.from(decryptData, 'utf-8'),
    ).toString('base64');
    const encryptPassword = rsaEncrypt(publicKey, password);
    if (encryptPassword === false) {
      return false;
    }
    const base64RandomNum = Buffer.from(this.randomNum, 'utf-8').toString(
      'base64',
    );
    return Promise.resolve(
      `${encryptData}${base64RandomNum}${encryptPassword}`,
    );
  }

  decryptDataWithPrivateKey(privateKey: string, encryptData: string) {
    if (this.randomNum.length === 0) {
      debugLogger.migrate.error('decryptData error: randomNum is empty');
      return false;
    }

    const base64RandomNum = Buffer.from(this.randomNum, 'utf-8').toString(
      'base64',
    );
    const array = encryptData.split(base64RandomNum);
    if (array.length === 2) {
      const password = rsaDecrypt(privateKey, array[1]);
      if (password === false) {
        return;
      }
      const decryptData = decrypt(
        password,
        Buffer.from(array[0], 'base64'),
      ).toString('utf-8');
      return decryptData;
    }
  }

  get baseUrl() {
    return `${getFiatEndpoint()}/migrate`;
  }

  @backgroundMethod()
  async publicKey(type: 'Server' | 'Client') {
    return Promise.resolve(
      type === 'Server' ? this.serverPubKey : this.clientPubKey,
    );
  }

  @backgroundMethod()
  async generateRandomNum() {
    const string =
      randomString(RAMDOMNUM_LEAGTH / 2, 'ABCDEFGHJKLMNPQRSTUVWXYZ') +
      randomString(RAMDOMNUM_LEAGTH / 2, '123456789');
    this.randomNum = shuffle(string);
    return Promise.resolve(this.randomNum);
  }

  @backgroundMethod()
  async clearMigrateInfo(deleteKey = this.connectUUID) {
    if (deleteKey.length > 0) {
      this.deletePublicKey({ key: deleteKey });
    }
    this.connectUUID = '';
    this.serverPubKey = '';
    this.clientPubKey = '';
    this.randomNum = '';

    return Promise.resolve(true);
  }

  @backgroundMethod()
  async getPublicKey(params: { key: string; type: 'Server' | 'Client' }) {
    const urlParams = new URLSearchParams(params);
    const apiUrl = `${this.baseUrl}/key?${urlParams.toString()}`;
    const { data } = await this.client
      .get<MigrateServiceResp<string>>(apiUrl)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: undefined }));
    return data;
  }

  @backgroundMethod()
  async uploadPublicKey(params: {
    key: string;
    type: 'Server' | 'Client';
    publicKey: string;
  }) {
    const { publicKey, ...rest } = params;
    const base64 = Buffer.from(publicKey, 'utf-8').toString('base64');
    const apiUrl = `${this.baseUrl}/upload`;
    const { success } = await this.client
      .post<MigrateServiceResp<undefined>>(apiUrl, {
        ...rest,
        publicKey: base64,
      })
      .then((resp) => resp.data)
      .catch(() => ({ success: false }));
    return success;
  }

  @backgroundMethod()
  async deletePublicKey(params: { key: string }) {
    const urlParams = new URLSearchParams(params);
    const apiUrl = `${this.baseUrl}/delete?${urlParams.toString()}`;
    const { success } = await this.client
      .get<MigrateServiceResp<undefined>>(apiUrl)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: undefined }));
    return success;
  }

  @backgroundMethod()
  async connectServer(serverUrl: string) {
    if (this.keypair === undefined) {
      debugLogger.migrate.error('keypair not ready');
      if (this.keyPairProgress === false) {
        this.setupKeypair({ reset: true });
      }
    }
    const array = serverUrl.split('/');
    if (array.length === 2 && this.keypair) {
      const [ipAddress, randomNum] = array;
      if (randomNum.length !== RAMDOMNUM_LEAGTH) {
        return;
      }
      this.randomNum = randomNum;
      const urlParams = new URLSearchParams({
        deviceInfo: JSON.stringify(deviceInfo()),
        uuid: this.ensureUUID({ reset: true }),
      });
      const uploadSuccess = await this.uploadPublicKey({
        key: this.ensureUUID({ reset: false }),
        type: 'Client',
        publicKey: this.keypair.publicKey,
      });
      if (!uploadSuccess) {
        return;
      }
      const url = `${ServerUrl(
        ipAddress,
        MigrateAPINames.Connect,
      )}?${urlParams.toString()}`;
      const { success, data, message } = await this.client
        .get<
          MigrateServiceResp<{
            deviceInfo: DeviceInfo;
            password: string;
          }>
        >(url, { timeout: 60 * 1000 })
        .then((resp) => resp.data)
        .catch((e: AxiosError) => ({
          success: false,
          data: undefined,
          message: e.code,
        }));
      if (!success || data === undefined) {
        this.clearMigrateInfo(this.ensureUUID({ reset: false }));
        if (message) {
          return message;
        }
        return;
      }
      const { deviceInfo: serverInfo, password } = data;

      const result = rsaDecrypt(this.keypair.privateKey, password);
      if (result === false) {
        return;
      }
      if (result !== this.randomNum) {
        this.disConnectServer(ipAddress);
        this.clearMigrateInfo(this.ensureUUID({ reset: false }));
        return;
      }
      const serverPubKey = await this.getPublicKey({
        key: this.ensureUUID({ reset: false }),
        type: 'Server',
      });

      if (serverPubKey === undefined || serverPubKey.length === 0) {
        debugLogger.migrate.error('Get server PublicKey fail');
        this.clearMigrateInfo(this.ensureUUID({ reset: false }));
        return;
      }
      this.serverPubKey = Buffer.from(serverPubKey, 'base64').toString('utf-8');
      return serverInfo;
    }
  }

  @backgroundMethod()
  async disConnectServer(ipAddress: string) {
    this.clearMigrateInfo();
    const urlParams = new URLSearchParams({
      uuid: this.ensureUUID({ reset: false }),
    });
    this.clientPubKey = '';
    const url = `${ServerUrl(
      ipAddress,
      MigrateAPINames.DisConnect,
    )}?${urlParams.toString()}`;
    const { success } = await this.client
      .get<MigrateServiceResp<boolean>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false }));
    if (!platformEnv.isNative) {
      this.setupKeypair({ reset: true });
    }
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

    try {
      if (this.serverPubKey.length === 0) {
        debugLogger.migrate.error('sendDataToServer serverKey empty');
        return false;
      }

      const encryptData = await this.encryptDataWithPublicKey(
        this.serverPubKey,
        data,
      );

      if (encryptData === false) {
        return false;
      }
      const { success } = await this.client
        .post<MigrateServiceResp<boolean>>(url, encryptData, {
          headers: {
            'Content-Type': 'text/plain',
          },
        })
        .then((resp) => resp.data)
        .catch((error) => {
          debugLogger.migrate.error('sendDataToServer :', error);
          return {
            success: false,
          };
        });
      return success;
    } catch (error) {
      debugLogger.migrate.error('sendDataToServer encrypt:', error);
      return false;
    }
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

    if (this.keypair === undefined) {
      debugLogger.migrate.error('keypair lose');
      return;
    }
    const result = await this.client
      .get<MigrateServiceResp<string>>(url)
      .then((resp) => resp.data)
      .catch(() => ({
        success: false,
        data: undefined,
        code: MigrateErrorCode.ConnectFail,
      }));

    const { success, data: encryptData, code } = result;

    if (success && encryptData && encryptData.length > 0) {
      const decryptData = this.decryptDataWithPrivateKey(
        this.keypair.privateKey,
        encryptData,
      );
      if (typeof decryptData === 'string') {
        try {
          return parseCloudData(JSON.parse(decryptData)) as MigrateData;
        } catch {
          debugLogger.migrate.error('parse decryptData error');
        }
      }
    }
    return code;
  }

  @backgroundMethod()
  isConnectedUUID(uuid: string) {
    if (this.connectUUID.length > 0 && uuid === this.connectUUID) {
      return true;
    }
    return false;
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

    const failResponse = (message: string, code?: number) => {
      debugLogger.migrate.error(`apiName:${apiName},error:${message}`);
      serviceHTTP.serverRespond({
        requestId,
        respondData: { success: false, message, code },
      });
    };
    if (uuid.length === 0) {
      failResponse('uuid  is required', MigrateErrorCode.ConnectFail);
      return;
    }

    if (apiName === MigrateAPINames.Connect) {
      if (this.connectUUID.length > 0) {
        failResponse('service already connected', MigrateErrorCode.ConnectFail);
        return;
      }
      if (this.keypair === undefined) {
        debugLogger.migrate.error('keypair not ready');
        if (this.keyPairProgress === false) {
          this.setupKeypair({ reset: true });
        }
      }
      this.connectUUID = uuid;
      this.getPublicKey({ key: uuid, type: 'Client' }).then((clientPubKey) => {
        if (clientPubKey && clientPubKey.length > 0 && this.keypair) {
          this.clientPubKey = Buffer.from(clientPubKey, 'base64').toString(
            'utf-8',
          );
          this.uploadPublicKey({
            key: uuid,
            type: 'Server',
            publicKey: this.keypair.publicKey,
          }).then((success) => {
            if (success) {
              const password = rsaEncrypt(this.clientPubKey, this.randomNum);
              if (password === false) {
                this.clearMigrateInfo();
                failResponse(
                  'rsaEncrypt randomNum fail',
                  MigrateErrorCode.EncryptFail,
                );
              }
              serviceHTTP.serverRespond({
                requestId,
                respondData: {
                  success: true,
                  data: {
                    deviceInfo: deviceInfo(),
                    password,
                  },
                },
              });
            } else {
              this.clearMigrateInfo();
              failResponse(
                'Upload server public key fail',
                MigrateErrorCode.PublicKeyError,
              );
            }
          });
        } else {
          this.clearMigrateInfo();
          failResponse(
            'Get client public key',
            MigrateErrorCode.PublicKeyError,
          );
        }
      });
    } else if (apiName === MigrateAPINames.DisConnect) {
      if (this.isConnectedUUID(uuid)) {
        serviceHTTP.serverRespond({
          requestId,
          respondData: { success: true },
        });
        if (!platformEnv.isNative) {
          this.setupKeypair({ reset: true });
        }
        this.clearMigrateInfo();

        appUIEventBus.emit(AppUIEventBusNames.Migrate, {
          type: MigrateNotificationNames.UpdateQrcode,
          data: {} as RequestData,
        });
      } else {
        failResponse('uuid not match', MigrateErrorCode.UUIDNotMatch);
      }
    } else if (apiName === MigrateAPINames.SendData) {
      if (!this.isConnectedUUID(uuid)) {
        failResponse('uuid not match', MigrateErrorCode.UUIDNotMatch);
        return;
      }
      const { postData: encryptData } = data;
      if (encryptData === undefined) {
        failResponse('encryptData not found', MigrateErrorCode.ConnectFail);
        return;
      }
      if (this.keypair === undefined) {
        failResponse('keypair lose', MigrateErrorCode.KetPairLose);
        return;
      }
      const decryptData = this.decryptDataWithPrivateKey(
        this.keypair.privateKey,
        encryptData,
      );

      appUIEventBus.emit(AppUIEventBusNames.Migrate, {
        type: MigrateNotificationNames.ReceiveDataFromClient,
        data: { requestId, postData: decryptData },
      });
    } else if (apiName === MigrateAPINames.RequestData) {
      if (!this.isConnectedUUID(uuid)) {
        failResponse('uuid not match', MigrateErrorCode.UUIDNotMatch);
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
    this.connectUUID = '';
    appEventBus.removeListener(
      AppEventBusNames.HttpServerRequest,
      this.receivedHttpRequest,
    );
  }
}

export default ServiceMigrate;
