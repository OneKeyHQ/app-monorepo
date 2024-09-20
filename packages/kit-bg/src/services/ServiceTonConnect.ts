import { EventSourcePolyfill } from 'event-source-polyfill';
import nacl from 'tweetnacl';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import EventSource from '@onekeyhq/shared/src/eventSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import ServiceBase from './ServiceBase';

import type { ITonConnectValue } from './ServiceScanQRCode/utils/parseQRCode/type';
import type ProviderApiTon from '../providers/ProviderApiTon';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

interface ITonConnectLocalData {
  lastEventId?: string;
  keyPair?: {
    privateKey: string;
    publicKey: string;
  };
}

const TON_CONNECT_HTTP_BRIDGE = 'https://bridge.tonapi.io/bridge';
const TON_CONNECT_STORAGE_KEY = 'tonConnect';

let isListened = false;

@backgroundClass()
class ServiceTonConnect extends ServiceBase {
  provider: ProviderApiTon;

  private publicKey?: Uint8Array;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    this.provider = this.backgroundApi.providers.ton as ProviderApiTon;
    void this.loadKeyPair();
  }

  public init() {
    if (!isListened) {
      isListened = true;
      void this.listen();
    }
  }

  private async loadKeyPair() {
    const keyPair = await this.getKeyPair();
    this.publicKey = keyPair.publicKey;
  }

  private async getKeyPair() {
    const localData = await this.loadLocalData();
    if (localData.keyPair) {
      return {
        privateKey: bufferUtils.hexToBytes(localData.keyPair.privateKey),
        publicKey: bufferUtils.hexToBytes(localData.keyPair.publicKey),
      };
    }
    const pair = nacl.box.keyPair();
    await this.saveLocalData({
      keyPair: {
        privateKey: bufferUtils.bytesToHex(pair.secretKey),
        publicKey: bufferUtils.bytesToHex(pair.publicKey),
      },
    });
    return {
      privateKey: pair.secretKey,
      publicKey: pair.publicKey,
    };
  }

  private async listen() {
    const localData = await this.loadLocalData();
    const clientId = await this.getClientId();
    console.log('tonConnect listen EventSource', clientId);
    const url = `${TON_CONNECT_HTTP_BRIDGE}/events?client_id=${clientId}&last_event_id=${
      localData.lastEventId || ''
    }`;
    const onMessage = async (event: {
      data: string | null;
      lastEventId: string | null;
    }) => {
      console.log('tonConnect EventSource: ', event);
      if (!event.data) {
        return;
      }
      const data = JSON.parse(event.data) as {
        from: string;
        message: string;
      };
      const msg = await this.decrypt({
        message: data.message,
        senderPublicKey: bufferUtils.hexToBytes(data.from),
      });
      if (!msg) {
        console.error('tonConnect msg is empty');
        return;
      }
      console.log('tonConnect msg: ', Buffer.from(msg).toString());
      await this.handleMsg({
        msg: Buffer.from(msg).toString(),
        fromClientId: data.from,
      });
      await this.saveLocalData({
        lastEventId: event.lastEventId || '',
      });
    };
    const onError = (event: any) => {
      console.log('tonConnect EventSource error: ', event);
    };
    const onOpen = (event: any) => {
      console.log('tonConnect EventSource open: ', event);
    };
    if (platformEnv.isExtension) {
      const es = new EventSourcePolyfill(url);
      es.onmessage = onMessage;
      es.onerror = onError;
      es.onopen = onOpen;
    } else {
      const es = new EventSource(url);
      es.addEventListener('message', onMessage);
      es.addEventListener('error', onError);
      es.addEventListener('open', onOpen);
    }
    console.log('tonConnect listen EventSource end');
  }

  private async getOriginByClientId(clientId: string) {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    if (!rawData || typeof rawData !== 'object' || !rawData.data) {
      return undefined;
    }
    const tonConnectData = rawData.data.tonConnect;
    return Object.keys(tonConnectData).find(
      (key) => tonConnectData[key].tonConnectClientId === clientId,
    );
  }

  private async handleMsg({
    msg,
    fromClientId,
  }: {
    msg: string;
    fromClientId: string;
  }) {
    const data = JSON.parse(msg) as {
      method: string;
      params: string[];
      id: string;
    };
    if (data.method in this.provider) {
      const params = data.params.map((e) => JSON.parse(e) as unknown);
      const origin = await this.getOriginByClientId(fromClientId);
      const request: IJsBridgeMessagePayload = {
        scope: this.provider.providerName,
        origin,
        tonConnectClientId: fromClientId,
      };
      let res;
      const resMsg: {
        result?: any;
        error?: any;
        id: string;
      } = {
        id: data.id,
      };
      switch (data.method) {
        case 'sendTransaction':
          res = await this.provider
            .sendTransaction(request, params[0] as any)
            .catch((e) => {
              console.error(e);
              resMsg.error = {
                code: 300,
              };
            });
          if (res) {
            resMsg.result = res;
          }
          break;
        case 'disconnect':
          await this.disconnect(fromClientId);
          break;
        default:
          resMsg.error = {
            code: 400,
          };
      }
      await this.sendMsg({
        msg: JSON.stringify(resMsg),
        toClientId: fromClientId,
      });
    }
  }

  private async encrypt({
    data,
    receiverPublicKey,
  }: {
    data: Uint8Array;
    receiverPublicKey: Uint8Array;
  }) {
    const pair = await this.getKeyPair();
    const nonce = nacl.randomBytes(24);
    const content = nacl.box(data, nonce, receiverPublicKey, pair.privateKey);
    return Buffer.concat([nonce, content]).toString('base64');
  }

  private async decrypt({
    message,
    senderPublicKey,
  }: {
    message: string;
    senderPublicKey: Uint8Array;
  }) {
    const bytes = Buffer.from(message, 'base64');
    const msgNonce = bytes.subarray(0, 24);
    const msgContent = bytes.subarray(24);
    const pair = await this.getKeyPair();
    return nacl.box.open(
      msgContent,
      msgNonce,
      senderPublicKey,
      pair.privateKey,
    );
  }

  private async getClientId() {
    if (!this.publicKey) {
      await this.loadKeyPair();
      if (!this.publicKey) {
        throw new OneKeyError('Public key not found');
      }
    }
    return bufferUtils.bytesToHex(this.publicKey);
  }

  private async saveLocalData(data: ITonConnectLocalData) {
    const localData = await appStorage.getItem(TON_CONNECT_STORAGE_KEY);
    let localDataObj: ITonConnectLocalData = {};
    if (localData) {
      localDataObj = JSON.parse(localData) as ITonConnectLocalData;
    }
    await appStorage.setItem(
      TON_CONNECT_STORAGE_KEY,
      JSON.stringify({
        ...localDataObj,
        ...data,
      }),
    );
  }

  private async loadLocalData() {
    const localData = await appStorage.getItem(TON_CONNECT_STORAGE_KEY);
    if (localData) {
      return JSON.parse(localData) as ITonConnectLocalData;
    }
    return {};
  }

  private async sendMsg({
    msg,
    toClientId,
  }: {
    msg: string;
    toClientId: string;
  }) {
    const clientId = await this.getClientId();
    const res = await fetch(
      `${TON_CONNECT_HTTP_BRIDGE}/message?client_id=${clientId}&to=${toClientId}&ttl=300`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: await this.encrypt({
          data: Buffer.from(msg),
          receiverPublicKey: bufferUtils.hexToBytes(toClientId),
        }),
      },
    ).then((e) => e.json());
    console.log('tonConnect sendMsg: ', res, msg);
  }

  @backgroundMethod()
  public async connect(params: ITonConnectValue) {
    const {
      r: { manifestUrl, items },
      id,
    } = params;
    if (!manifestUrl) {
      await this.sendMsg({
        msg: JSON.stringify({
          event: 'connect_error',
          id: 0,
          payload: {
            code: 2,
          },
        }),
        toClientId: id,
      });
      return;
    }
    const manifest = (await fetch(manifestUrl).then((res) => res.json())) as {
      url?: string;
      name?: string;
      iconUrl?: string;
    };
    if (!manifest || !manifest.url || !manifest.name) {
      await this.sendMsg({
        msg: JSON.stringify({
          event: 'connect_error',
          id: 0,
          payload: {
            code: 3,
          },
        }),
        toClientId: id,
      });
      return;
    }
    const origin = new URL(manifest.url).origin;
    const request: IJsBridgeMessagePayload = {
      scope: this.provider.providerName,
      origin,
      tonConnectClientId: id,
    };

    const resItems = [];
    for (const item of items) {
      if (item.name === 'ton_addr') {
        const connectedAccount = await this.provider
          .connect(request, [])
          .catch(async (e) => {
            await this.sendMsg({
              msg: JSON.stringify({
                event: 'connect_error',
                id: 0,
                payload: {
                  code: 300,
                },
              }),
              toClientId: id,
            });
          });
        if (!connectedAccount) {
          return;
        }
        resItems.push({
          name: 'ton_addr',
          ...connectedAccount,
        });
      } else if (item.name === 'ton_proof') {
        const proof = await this.provider.signProof(request, {
          payload: item.payload as string,
        });
        resItems.push({
          name: 'ton_proof',
          proof,
        });
      }
    }

    await this.sendMsg({
      msg: JSON.stringify({
        event: 'connect',
        id: Date.now(),
        payload: {
          items: resItems,
          device: await this.provider.getDeviceInfo(request),
        },
      }),
      toClientId: id,
    });
  }

  private async disconnect(clientId: string) {
    const origin = await this.getOriginByClientId(clientId);
    if (!origin) {
      return;
    }
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'tonConnect',
    });
  }
}

export default ServiceTonConnect;
