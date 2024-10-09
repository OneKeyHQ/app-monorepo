import axios from 'axios';
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

let eventSource: EventSource | EventSourcePolyfill | undefined;

@backgroundClass()
class ServiceTonConnect extends ServiceBase {
  provider: ProviderApiTon;

  private request = axios.create({
    baseURL: TON_CONNECT_HTTP_BRIDGE,
  });

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    this.provider = this.backgroundApi.providers.ton as ProviderApiTon;
  }

  public async init() {
    if (!eventSource) {
      const connections =
        await this.backgroundApi.simpleDb.tonConnect.getAllConnections();
      if (connections.length === 0) {
        return;
      }
      void this.listen();
    }
  }

  private genClientInfo() {
    const pair = nacl.box.keyPair();
    return {
      clientCode: bufferUtils.bytesToHex(pair.secretKey),
      clientId: bufferUtils.bytesToHex(pair.publicKey),
    };
  }

  private async listen() {
    const lastEventId =
      await this.backgroundApi.simpleDb.tonConnect.getLastEventId();
    const clientIds =
      await this.backgroundApi.simpleDb.tonConnect.getAllClientIds();
    const url = `${TON_CONNECT_HTTP_BRIDGE}/events?client_id=${clientIds.join(
      ',',
    )}&last_event_id=${lastEventId}`;
    const onMessage = async (event: {
      data: string | null;
      lastEventId: string | null;
    }) => {
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
        return;
      }
      await this.handleMsg({
        msg: Buffer.from(msg).toString(),
        fromClientId: data.from,
      });
      await this.backgroundApi.simpleDb.tonConnect.setLastEventId({
        lastEventId: event.lastEventId || '',
      });
    };
    const onError = (event: any) => {
      console.error('tonConnect EventSource error: ', event);
    };
    if (platformEnv.isExtension) {
      eventSource = new EventSourcePolyfill(url);
      eventSource.onmessage = onMessage;
      eventSource.onerror = onError;
    } else {
      eventSource = new EventSource(url);
      eventSource.addEventListener('message', onMessage);
      eventSource.addEventListener('error', onError);
    }
  }

  private async reListen() {
    eventSource?.close();
    await this.listen();
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
      const { origin } = await this.getConnectionInfo({
        connectorId: fromClientId,
      });
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
              .catch(() => {
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

  private async getConnectionInfo({ connectorId }: { connectorId: string }) {
    const connection =
      await this.backgroundApi.simpleDb.tonConnect.getConnectionInfo({
        connectorId,
      });
    if (!connection) {
      throw new OneKeyError('Connection not found');
    }
    return connection;
  }

  private async encrypt({
    data,
    receiverPublicKey,
  }: {
    data: Uint8Array;
    receiverPublicKey: Uint8Array;
  }) {
    const connection = await this.getConnectionInfo({
      connectorId: bufferUtils.bytesToHex(receiverPublicKey),
    });
    const nonce = nacl.randomBytes(24);
    const content = nacl.box(
      data,
      nonce,
      receiverPublicKey,
      bufferUtils.hexToBytes(connection.clientCode),
    );
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
    const connection = await this.getConnectionInfo({
      connectorId: bufferUtils.bytesToHex(senderPublicKey),
    });
    return nacl.box.open(
      msgContent,
      msgNonce,
      senderPublicKey,
      bufferUtils.hexToBytes(connection.clientCode),
    );
  }

  private async sendMsg({
    msg,
    toClientId,
  }: {
    msg: string;
    toClientId: string;
  }) {
    const connection = await this.getConnectionInfo({
      connectorId: toClientId,
    });
    const { data } = await this.request.post<{
      statusCode?: number;
      message?: string;
    }>(
      `/message?client_id=${connection.clientId}&to=${toClientId}&ttl=300`,
      await this.encrypt({
        data: Buffer.from(msg),
        receiverPublicKey: bufferUtils.hexToBytes(toClientId),
      }),
    );
    if (data.statusCode !== 200) {
      throw new OneKeyError(data.message);
    }
    console.log(
      'tonConnect sendMsg:',
      msg,
      'to:',
      toClientId,
      'response data:',
      data,
    );
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
          id: Date.now(),
          payload: {
            code: 2,
          },
        }),
        toClientId: id,
      });
      return;
    }
    const { data: manifest } = await this.request.get<{
      url?: string;
      name?: string;
      iconUrl?: string;
    }>(manifestUrl);
    if (!manifest || !manifest.url || !manifest.name) {
      await this.sendMsg({
        msg: JSON.stringify({
          event: 'connect_error',
          id: Date.now(),
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
                id: Date.now(),
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
        const newClient = this.genClientInfo();
        await this.backgroundApi.simpleDb.tonConnect.setConnection({
          origin,
          connectorId: id,
          connectorAddress: connectedAccount.address,
          clientId: newClient.clientId,
          clientCode: newClient.clientCode,
        });
        void this.reListen();
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
    const { origin } = await this.getConnectionInfo({
      connectorId: clientId,
    });
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
    const connections =
      await this.backgroundApi.simpleDb.tonConnect.getAllConnections();
    for (const connection of connections) {
      await this.sendMsg({
        msg: JSON.stringify({
          event: 'disconnect',
          id: Date.now(),
          payload: {},
        }),
        toClientId: connection.connectorId,
      });
    }
    await this.backgroundApi.simpleDb.tonConnect.clearConnections();
  }

  @backgroundMethod()
  public async notifyDisconnect(origin: string) {
    const clientIds = (
      await this.backgroundApi.simpleDb.tonConnect.getConnectionsByOrigin({
        origin,
      })
    ).map((item) => item.connectorId);
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
        await this.backgroundApi.simpleDb.tonConnect.removeOrigin({ origin });
      }
    }
  }

  @backgroundMethod()
  public async notifyAccountsChanged({ origin }: { origin: string }) {
    const connections =
      await this.backgroundApi.simpleDb.tonConnect.getConnectionsByOrigin({
        origin,
      });
    if (connections.length === 0) {
      return;
    }
    const request = {
      scope: this.provider.providerName,
      origin,
      tonConnectClientId: connections[0].connectorId,
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

    if (accountResponse.address === connections[0].connectorAddress) {
      return;
    }

    await this.backgroundApi.simpleDb.tonConnect.setConnectorAddress({
      origin,
      connectorAddress: accountResponse.address,
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
    for (const connection of connections) {
      await this.sendMsg({
        msg,
        toClientId: connection.connectorId,
      });
    }
  }
}

export default ServiceTonConnect;
