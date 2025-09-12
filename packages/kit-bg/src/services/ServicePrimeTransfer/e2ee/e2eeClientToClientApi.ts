import { decryptAsync } from '@onekeyhq/core/src/secret';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import appDeviceInfo from '@onekeyhq/shared/src/appDeviceInfo/appDeviceInfo';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { buildCallRemoteApiMethod } from '../../../apis/RemoteApiProxyBase';

import { JsBridgeE2EEClientToClient } from './JsBridgeE2EEClientToClient';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io';

// TODO clear selfPairingCode when transfer complete or exit
let selfPairingCode: string | null = null;
let isVerifiedRoomId: string | null = null;

// ECDHE Key exchange interfaces (matching client side)
export interface IECDHEKeyExchangeRequest {
  userId: string;
  encryptedData: string;
  // Client's ephemeral public key (hex)
  clientPublicKey: string;
}

export interface IECDHEKeyExchangeResponse {
  success: boolean;
  // Server's ephemeral public key (hex)
  serverPublicKey?: string;
}

export interface IE2EEClientToClientApi {
  api: E2EEClientToClientApi;
}
export type IE2EEClientToClientApiKeys = keyof IE2EEClientToClientApi;

export async function generateEncryptedKey({
  pairingCode,
  sharedSecret,
  roomId,
}: {
  pairingCode: string;
  sharedSecret: string;
  roomId: string;
}): Promise<string> {
  if (!roomId) {
    throw new OneKeyLocalError('Room ID not set');
  }
  const users =
    await appGlobals.$backgroundApiProxy.servicePrimeTransfer.getRoomUsers({
      roomId,
    });
  const usersStr = stringUtils.stableStringify(users);
  return `${pairingCode.toUpperCase()}--${sharedSecret}--${usersStr}`;
}

export class E2EEClientToClientApi {
  private _roomId: string | undefined;

  private verifyPairingCodeTimes = 0;

  get roomId(): string | undefined {
    return this._roomId;
  }

  set roomId(value: string) {
    if (value !== this._roomId) {
      this.verifyPairingCodeTimes = 0;
      isVerifiedRoomId = null;
    }
    this._roomId = value;
  }

  async hello() {
    const deviceInfo = await appDeviceInfo.getDeviceInfo();
    return `world: ${deviceInfo.displayName || ''}`;
  }

  async changeTransferDirection({
    roomId,
    fromUserId,
    toUserId,
  }: {
    roomId: string;
    fromUserId: string;
    toUserId: string;
  }) {
    if (roomId !== this.roomId) {
      throw new OneKeyLocalError('Room ID not match');
    }
    let transferDirection: { fromUserId: string; toUserId: string } | undefined;
    if (fromUserId === toUserId) {
      transferDirection = undefined;
    } else {
      transferDirection = { fromUserId, toUserId };
    }

    await appGlobals.$backgroundApiProxy.servicePrimeTransfer.handleTransferDirectionChanged(
      {
        roomId,
        ...transferDirection,
      },
    );
    return transferDirection;
  }

  async verifyPairingCode(
    keyExchangeRequest: IECDHEKeyExchangeRequest,
  ): Promise<IECDHEKeyExchangeResponse> {
    const { userId, encryptedData, clientPublicKey } = keyExchangeRequest;

    if (isVerifiedRoomId === this.roomId) {
      const message = appLocale.intl.formatMessage({
        // eslint-disable-next-line spellcheck/spell-checker
        id: ETranslations.global_connet_error_try_again,
      });
      appEventBus.emit(EAppEventBusNames.PrimeTransferForceExit, {
        title: message,
        description: platformEnv.isDev ? 'PairingCodeAlreadyVerifiedError' : '',
      });
      throw new OneKeyLocalError(message);
    }

    this.verifyPairingCodeTimes += 1;
    if (this.verifyPairingCodeTimes > (platformEnv.isDev ? 3 : 10)) {
      const message = appLocale.intl.formatMessage({
        id: ETranslations.transfer_pair_code_enter_over_limit,
      });
      appEventBus.emit(EAppEventBusNames.PrimeTransferForceExit, {
        title: message,
        description: platformEnv.isDev ? 'PairingCodeEnterOverLimitError' : '',
      });
      throw new OneKeyLocalError(message);
    }

    // TODO check if userId is in the room
    await timerUtils.wait(1000);

    if (!selfPairingCode) {
      throw new OneKeyLocalError('Self pairing code not set');
    }
    if (!encryptedData) {
      throw new OneKeyLocalError('Encrypted data not set');
    }
    if (!clientPublicKey) {
      throw new OneKeyLocalError('Client public key not provided');
    }
    if (!this.roomId) {
      throw new OneKeyLocalError('Room ID not set');
    }

    try {
      // Verify the encrypted data using self pairing code
      const decryptedData = await decryptAsync({
        password: selfPairingCode,
        data: encryptedData,
        allowRawPassword: true,
      });
      const result = bufferUtils.bytesToUtf8(decryptedData);
      if (result !== 'OneKeyPrimeTransfer') {
        const message = appLocale.intl.formatMessage({
          id: ETranslations.transfer_invalid_code,
        });
        throw new OneKeyLocalError(message);
      }

      // Validate client public key format (should be 66 hex chars for compressed secp256k1)
      if (!clientPublicKey || clientPublicKey.length !== 66) {
        throw new OneKeyLocalError('Invalid client public key format');
      }

      // Generate server ECDHE key pair
      const serverKeyPair = await appCrypto.ECDHE.generateECDHEKeyPair();

      // Derive shared secret using ECDHE
      let sharedSecret = await appCrypto.ECDHE.getSharedSecret({
        privateKey: serverKeyPair.privateKey,
        publicKey: clientPublicKey,
      });

      // Clear server ephemeral private key immediately (forward secrecy)
      serverKeyPair.privateKey = '';

      // Derive symmetric key from ECDHE shared secret and pairing code
      let encryptedKey = await generateEncryptedKey({
        pairingCode: selfPairingCode,
        sharedSecret,
        roomId: this.roomId,
      });

      // Clear shared secret from memory
      sharedSecret = '';

      // Notify success
      void appGlobals.$backgroundApiProxy.servicePrimeTransfer.handleClientsSuccessPaired(
        {
          roomId: this.roomId,
          pairingCode: selfPairingCode || '',
          encryptedKey: encryptedKey || '',
        },
      );
      encryptedKey = '';

      await timerUtils.wait(300);
      isVerifiedRoomId = this.roomId;

      return {
        success: true,
        serverPublicKey: serverKeyPair.publicKey,
      };
    } catch (error) {
      console.error('InvalidPairingCodeError:', error);
      const message = appLocale.intl.formatMessage({
        id: ETranslations.transfer_invalid_code,
      });
      throw new OneKeyLocalError(message);
    }
  }

  async cancelTransfer() {
    appEventBus.emit(EAppEventBusNames.PrimeTransferCancel, undefined);
  }

  async sendTransferData({ rawData }: { rawData: string }) {
    await appGlobals.$backgroundApiProxy.servicePrimeTransfer.receiveTransferData(
      {
        rawData,
      },
    );
  }
}
const clientToClientApi = new E2EEClientToClientApi();

function createBridgeE2EEClientToClient({
  socket,
  roomId,
}: {
  socket: Socket;
  roomId: string;
}) {
  clientToClientApi.roomId = roomId;

  const createE2EEClientToClientApiModule = memoizee(
    async (name: IE2EEClientToClientApiKeys) => {
      if (name === 'api') {
        return clientToClientApi;
      }
      throw new OneKeyLocalError(
        `Unknown E2EE Client to Client API module: ${name as string}`,
      );
    },
    {
      promise: true,
    },
  );

  const callE2EEClientToClientApiMethod = buildCallRemoteApiMethod(
    createE2EEClientToClientApiModule,
    'e2eeClientToClientApi',
  );

  return new JsBridgeE2EEClientToClient(
    {
      receiveHandler: async (payload) => {
        const req: IJsonRpcRequest = payload.data as IJsonRpcRequest;

        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const result = await callE2EEClientToClientApiMethod(req);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      },
    },
    {
      socket,
      roomId,
      isProxySide: false,
    },
  );
}

function e2eeClientToClientApiSetup({
  socket,
  roomId,
}: {
  socket: Socket;
  roomId: string;
}) {
  const bridge = createBridgeE2EEClientToClient({
    socket,
    roomId,
  });
  return bridge;
}
function setSelfPairingCode({ pairingCode }: { pairingCode: string }) {
  selfPairingCode = pairingCode;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getSelfPairingCode() {
  return selfPairingCode;
}

function checkIsVerifiedRoomId(roomId: string) {
  if (isVerifiedRoomId !== roomId) {
    throw new OneKeyLocalError('Room ID not verified');
  }
}

// Clear all sensitive data
function clearSensitiveData() {
  selfPairingCode = null;
  isVerifiedRoomId = null;
}

export default {
  setSelfPairingCode,
  e2eeClientToClientApiSetup,
  checkIsVerifiedRoomId,
  clearSensitiveData,
};
