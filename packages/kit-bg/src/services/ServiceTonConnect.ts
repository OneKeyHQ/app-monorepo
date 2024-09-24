import { EventSourcePolyfill } from 'event-source-polyfill';
import nacl from 'tweetnacl';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import EventSource from '@onekeyhq/shared/src/eventSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import ServiceBase from './ServiceBase';

import type { ITonConnectValue } from './ServiceScanQRCode/utils/parseQRCode/type';
import type ProviderApiTon from '../providers/ProviderApiTon';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const TON_CONNECT_HTTP_BRIDGE = 'https://bridge.tonapi.io/bridge';

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
    const localData = await this.backgroundApi.simpleDb.tonConnect.getKeyPair();
    if (localData) {
      return {
        privateKey: bufferUtils.hexToBytes(localData.privateKey),
        publicKey: bufferUtils.hexToBytes(localData.publicKey),
      };
    }
    const pair = nacl.box.keyPair();
    await this.backgroundApi.simpleDb.tonConnect.setKeyPair({
      privateKey: bufferUtils.bytesToHex(pair.secretKey),
      publicKey: bufferUtils.bytesToHex(pair.publicKey),
    });
    return {
      privateKey: pair.secretKey,
      publicKey: pair.publicKey,
    };
  }

  private async listen() {
    const localLastEventId =
      await this.backgroundApi.simpleDb.tonConnect.getLastEventId();
    const clientId = await this.getClientId();
    console.log('tonConnect listen EventSource', clientId);
    const url = `${TON_CONNECT_HTTP_BRIDGE}/events?client_id=${clientId}&last_event_id=${
      localLastEventId || ''
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
      await this.backgroundApi.simpleDb.tonConnect.setLastEventId(
        event.lastEventId || '',
      );
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
    const { method, params, id } = JSON.parse(msg) as {
      method?: string;
      params?: string[];
      id?: string;
    };
    const resMsg: {
      result?: any;
      error?: any;
      id?: string;
    } = {
      id,
    };
    if (method && params) {
      const decodedParams = params.map((e) => JSON.parse(e) as unknown);
      const origin = await this.getOriginByClientId(fromClientId);
      if (origin) {
        const request: IJsBridgeMessagePayload = {
          scope: this.provider.providerName,
          origin,
          tonConnectClientId: fromClientId,
        };
        let res;
        switch (method) {
          case 'sendTransaction':
            res = await this.provider
              .sendTransaction(request, decodedParams[0] as any)
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
      } else {
        resMsg.error = {
          code: 100,
        };
      }
    } else {
      resMsg.error = {
        code: 1,
      };
    }

    await this.sendMsg({
      msg: JSON.stringify(resMsg),
      toClientId: fromClientId,
    });
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

  private urlSafeDecode(urlEncoded: string) {
    try {
      return decodeURIComponent(urlEncoded.replace(/\+/g, '%20'));
    } catch (e) {
      return urlEncoded;
    }
  }

  @backgroundMethod()
  public async connect(params: ITonConnectValue) {
    const { r, id } = params;
    const { manifestUrl, items } = JSON.parse(this.urlSafeDecode(r)) as {
      manifestUrl: string;
      items: { name: 'ton_addr' | 'ton_proof'; payload?: string }[];
    };
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
          .catch(async () => {
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
        await this.backgroundApi.simpleDb.tonConnect.setOriginInfo({
          origin,
          clientId: id,
          accountAddress: connectedAccount.address,
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

  @backgroundMethod()
  public async disconnectAll() {
    const origins = await this.backgroundApi.simpleDb.tonConnect.getOrigins();
    for (const origin of origins) {
      await this.notifyDisconnect(origin);
    }
  }

  @backgroundMethod()
  public async notifyDisconnect(origin: string) {
    const clientIds =
      await this.backgroundApi.simpleDb.tonConnect.getOriginClientIds(origin);
    if (clientIds.length > 0) {
      for (const clientId of clientIds) {
        await this.sendMsg({
          msg: JSON.stringify({
            event: 'disconnect',
            id: Date.now(),
            payload: {},
          }),
          toClientId: clientId,
        });
        await this.backgroundApi.simpleDb.tonConnect.removeOrigin(origin);
      }
    }
  }

  @backgroundMethod()
  public async notifyAccountsChanged({ origin }: { origin: string }) {
    const clientIds =
      await this.backgroundApi.simpleDb.tonConnect.getOriginClientIds(origin);
    if (clientIds.length === 0) {
      return;
    }
    const request = {
      scope: this.provider.providerName,
      origin,
      tonConnectClientId: clientIds[0],
    };
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      await this.notifyDisconnect(origin);
      return;
    }
    const device = await this.provider.getDeviceInfo({
      origin,
    });
    const accountInfo = accountsInfo[0];
    const accountResponse = await this.provider.getAccountResponse(
      accountInfo.account,
      accountInfo.accountInfo?.networkId ?? '',
    );

    const connectedAccountAddress =
      await this.backgroundApi.simpleDb.tonConnect.getOriginAccountAddress(
        origin,
      );
    if (accountResponse.address === connectedAccountAddress) {
      return;
    }

    await this.backgroundApi.simpleDb.tonConnect.setOriginInfo({
      origin,
      accountAddress: accountResponse.address,
    });

    const msg = JSON.stringify({
      event: 'connect',
      id: Date.now(),
      payload: {
        items: [
          {
            name: 'ton_addr',
            ...accountResponse,
          },
        ],
        device,
      },
    });
    for (const id of clientIds) {
      await this.sendMsg({
        msg,
        toClientId: id,
      });
    }
  }
}

export default ServiceTonConnect;
