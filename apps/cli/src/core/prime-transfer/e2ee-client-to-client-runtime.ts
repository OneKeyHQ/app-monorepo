import * as secp256k1 from '@noble/secp256k1';

import { decryptAsync } from '@onekeyhq/core/src/secret';
import { buildCallRemoteApiMethod } from '@onekeyhq/kit-bg/src/apis/RemoteApiProxyBase';
import { JsBridgeE2EEClientToClient } from '@onekeyhq/kit-bg/src/services/ServicePrimeTransfer/e2ee/JsBridgeE2EEClientToClient';
import { TRANSFER_VERIFY_STRING } from '@onekeyhq/shared/src/consts/primeConsts';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { AppError, ERROR_CODES } from '../../errors';
import { secureWipe } from '../crypto-utils';

import {
  getTransferPairingRuntimeError,
  setTransferPairingRuntimeError,
} from './pairing-session-runtime';

import type {
  ITransferPairingRuntime,
  ITransferPayloadHandlingResult,
  ITransferServerApi,
  ITransferSocketLike,
  TransferPayloadHandler,
} from './transfer-types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

interface IECDHEKeyExchangeRequest {
  userId: string;
  encryptedData: string;
  clientPublicKey: string;
}

interface IECDHEKeyExchangeResponse {
  success: boolean;
  serverPublicKey?: string;
}

interface ICreateE2EEClientToClientRuntimeParams {
  socket: ITransferSocketLike;
  roomId: string;
  pairingCode: string;
  runtime: ITransferPairingRuntime;
  serverApi: ITransferServerApi;
  transferPayloadHandler?: TransferPayloadHandler;
}

interface IE2EEClientToClientRuntime {
  dispose(): void;
}

function createTransferNetworkError(
  message: string,
  {
    code = ERROR_CODES.NET_TRANSFER_UNREACHABLE.code,
    suggestion = 'Check your network connection and retry the App Transfer login flow',
    details,
    cause,
  }: {
    code?: string;
    suggestion?: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  } = {},
): AppError {
  return new AppError(code, message, suggestion, {
    ...(details ? { details } : {}),
    ...(cause !== undefined ? { cause } : {}),
  });
}

function createTransferDecryptionError(
  message = 'Failed to decrypt the App Transfer payload.',
  suggestion = 'Retry the App Transfer login flow from OneKey App',
): AppError {
  return new AppError(
    ERROR_CODES.SEC_DECRYPTION_FAILED.code,
    message,
    suggestion,
  );
}

function isNetworkAppError(error: unknown): error is AppError {
  return error instanceof AppError && error.code.startsWith('NET_');
}

function mapTransferReachabilityError(
  error: unknown,
  {
    message,
    phase,
  }: {
    message: string;
    phase: string;
  },
): AppError {
  if (isNetworkAppError(error)) {
    return new AppError(error.code, error.message, error.suggestion, {
      cause: error,
      details: {
        ...error.details,
        phase,
      },
    });
  }

  const errorMessage = String(
    (error as { message?: string })?.message ?? '',
  ).toLowerCase();

  return createTransferNetworkError(message, {
    code: errorMessage.includes('timeout')
      ? ERROR_CODES.NET_TRANSFER_TIMEOUT.code
      : ERROR_CODES.NET_TRANSFER_UNREACHABLE.code,
    details: { phase },
    cause: error,
  });
}

function createTransferPairingError(
  message: string,
  suggestion = 'Retry the App Transfer login flow with the latest pairing code',
): AppError {
  return new AppError(
    ERROR_CODES.AUTH_TRANSFER_INVALID_PAIRING.code,
    message,
    suggestion,
  );
}

function createTransferPayloadError(
  message: string,
  suggestion = 'Retry the App Transfer login flow from OneKey App',
): AppError {
  return new AppError(
    ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
    message,
    suggestion,
  );
}

function resolveInactiveSessionError(
  runtime: ITransferPairingRuntime,
): AppError {
  const state = runtime.getState();

  if (state.status === 'timeout') {
    return new AppError(
      ERROR_CODES.AUTH_TRANSFER_TIMEOUT.code,
      state.message,
      'Retry the App Transfer login flow',
    );
  }

  if (state.status === 'cancelled') {
    return new AppError(
      ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
      state.message,
      'Retry the App Transfer login flow',
    );
  }

  if (state.status === 'failed') {
    return (
      getTransferPairingRuntimeError(runtime) ??
      createTransferNetworkError(
        'App Transfer failed before the wallet could be imported.',
        {
          code: ERROR_CODES.NET_REQUEST_FAILED.code,
          suggestion: 'Retry the App Transfer login flow',
        },
      )
    );
  }

  return new AppError(
    ERROR_CODES.AUTH_SESSION_INVALID.code,
    'App Transfer session is no longer active',
    'Retry the App Transfer login flow',
  );
}

function mapUnknownPairingError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return createTransferPairingError(
    'Failed to verify the App Transfer pairing request.',
  );
}

function mapUnknownPayloadError(
  error: unknown,
  phase: 'decrypt' | 'parse',
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (phase === 'decrypt') {
    return createTransferDecryptionError();
  }

  return createTransferPayloadError(
    'Failed to decode the App Transfer payload.',
  );
}

async function generateLocalECDHEKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, true);

  return {
    privateKey: bufferUtils.bytesToHex(privateKey),
    publicKey: bufferUtils.bytesToHex(publicKey),
  };
}

async function deriveLocalSharedSecret({
  privateKey,
  publicKey,
}: {
  privateKey: string;
  publicKey: string;
}): Promise<string> {
  if (privateKey.length !== 64 || publicKey.length !== 66) {
    throw createTransferPairingError('Invalid App Transfer ECDHE key material');
  }

  return bufferUtils.bytesToHex(
    secp256k1.getSharedSecret(
      bufferUtils.hexToBytes(privateKey),
      bufferUtils.hexToBytes(publicKey),
      true,
    ),
  );
}

async function buildConnectedEncryptedKey({
  pairingCode,
  sharedSecret,
  roomId,
  serverApi,
}: {
  pairingCode: string;
  sharedSecret: string;
  roomId: string;
  serverApi: ITransferServerApi;
}): Promise<string> {
  let users;
  try {
    users = await serverApi.roomManager.getRoomUsers({ roomId });
  } catch (error) {
    throw mapTransferReachabilityError(error, {
      message: 'Failed to verify the App Transfer pairing session.',
      phase: 'pairing_verification',
    });
  }

  return `${pairingCode.toUpperCase()}--${sharedSecret}--${stringUtils.stableStringify(users)}`;
}

function isTransferData(value: unknown): value is IPrimeTransferData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const privateData = (value as { privateData?: unknown }).privateData;
  return typeof privateData === 'object' && privateData !== null;
}

function clearTransferData(transferData: unknown): void {
  if (!isTransferData(transferData)) {
    return;
  }

  transferData.privateData.credentials = undefined;
  transferData.privateData.decryptedCredentials = undefined;
  transferData.privateData.decryptedCredentialsHex = undefined;
  transferData.privateData.deviceKeyPack = undefined;
}

export function createE2EEClientToClientRuntime({
  socket,
  roomId,
  pairingCode,
  runtime,
  serverApi,
  transferPayloadHandler,
}: ICreateE2EEClientToClientRuntimeParams): IE2EEClientToClientRuntime {
  let connectedEncryptedKey = '';
  let isDisposed = false;

  const assertSessionIsActive = (): void => {
    if (!isDisposed && !runtime.getState().isTerminal) {
      return;
    }

    throw resolveInactiveSessionError(runtime);
  };

  const dispose = () => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    connectedEncryptedKey = '';
  };

  const api = {
    async verifyPairingCode(
      keyExchangeRequest: IECDHEKeyExchangeRequest,
    ): Promise<IECDHEKeyExchangeResponse> {
      assertSessionIsActive();

      const { encryptedData, clientPublicKey } = keyExchangeRequest;

      if (!encryptedData) {
        throw createTransferPairingError(
          'Invalid App Transfer pairing payload',
        );
      }

      if (!clientPublicKey || clientPublicKey.length !== 66) {
        throw createTransferPairingError(
          'Invalid App Transfer client public key',
        );
      }

      let decryptedBytes: Buffer | null = null;
      const serverKeyPair = await generateLocalECDHEKeyPair();

      try {
        decryptedBytes = await decryptAsync({
          data: encryptedData,
          password: pairingCode.toUpperCase(),
          allowRawPassword: true,
        });

        const verifyString = bufferUtils.bytesToUtf8(decryptedBytes);
        if (verifyString !== TRANSFER_VERIFY_STRING) {
          throw createTransferPairingError('Invalid App Transfer pairing code');
        }

        let sharedSecret = await deriveLocalSharedSecret({
          privateKey: serverKeyPair.privateKey,
          publicKey: clientPublicKey,
        });

        serverKeyPair.privateKey = '';

        connectedEncryptedKey = await buildConnectedEncryptedKey({
          pairingCode,
          sharedSecret,
          roomId,
          serverApi,
        });
        sharedSecret = '';

        if (runtime.getState().status === 'pairing') {
          runtime.transition('pairing_verified');
        }

        return {
          success: true,
          serverPublicKey: serverKeyPair.publicKey,
        };
      } catch (error) {
        serverKeyPair.privateKey = '';
        connectedEncryptedKey = '';
        const appError = mapUnknownPairingError(error);
        if (isNetworkAppError(appError) && !runtime.getState().isTerminal) {
          setTransferPairingRuntimeError(runtime, appError);
          runtime.transition('transfer_failed');
        }
        throw appError;
      } finally {
        if (decryptedBytes) {
          secureWipe(decryptedBytes);
        }
      }
    },

    async getTransferType(): Promise<{ transferType: 'keylessWallet' }> {
      assertSessionIsActive();
      return { transferType: 'keylessWallet' };
    },

    async changeTransferDirection({
      roomId: targetRoomId,
      fromUserId,
      toUserId,
    }: {
      roomId: string;
      fromUserId: string;
      toUserId: string;
    }): Promise<
      | {
          fromUserId: string;
          toUserId: string;
        }
      | undefined
    > {
      assertSessionIsActive();

      if (targetRoomId !== roomId) {
        throw createTransferPayloadError('App Transfer room ID does not match');
      }

      if (fromUserId === toUserId) {
        return undefined;
      }

      return {
        fromUserId,
        toUserId,
      };
    },

    async cancelTransfer(): Promise<void> {
      if (isDisposed || runtime.getState().isTerminal) {
        return;
      }

      runtime.transition('transfer_cancelled');
      connectedEncryptedKey = '';
    },

    async sendTransferData({
      rawData,
    }: {
      rawData: string;
    }): Promise<{ success: true }> {
      assertSessionIsActive();

      if (!connectedEncryptedKey) {
        throw createTransferPayloadError(
          'App Transfer payload arrived before pairing verification completed',
        );
      }

      let encryptedBuffer: Buffer | null = null;
      let decryptedBuffer: Buffer | null = null;
      let transferData: unknown = null;
      let handlingResult: ITransferPayloadHandlingResult | void;
      let phase: 'decrypt' | 'parse' | 'handle' = 'decrypt';

      try {
        if (runtime.getState().status === 'pairing') {
          runtime.transition('pairing_verified');
        }
        if (runtime.getState().status !== 'receiving') {
          runtime.transition('transfer_receiving');
        }

        encryptedBuffer = Buffer.from(rawData, 'base64');
        decryptedBuffer = await decryptAsync({
          data: encryptedBuffer,
          password: connectedEncryptedKey,
          allowRawPassword: true,
        });

        phase = 'parse';
        transferData = JSON.parse(bufferUtils.bytesToUtf8(decryptedBuffer));
        if (!isTransferData(transferData)) {
          throw createTransferPayloadError('Invalid App Transfer payload');
        }

        if (!transferPayloadHandler) {
          throw createTransferPayloadError(
            'Transfer payload handler is unavailable',
          );
        }

        runtime.transition('transfer_importing');
        phase = 'handle';
        handlingResult = await transferPayloadHandler(transferData, {
          assertSessionIsActive,
        });

        const completionState = runtime.transition('transfer_completed');
        if (completionState.event !== 'transfer_completed') {
          await handlingResult?.rollback?.();
          throw createTransferPayloadError(
            'App Transfer session is no longer active',
          );
        }

        return { success: true };
      } catch (error) {
        let appError: AppError;
        if (phase === 'handle') {
          appError = error instanceof AppError ? error : AppError.from(error);
        } else {
          appError = mapUnknownPayloadError(error, phase);
        }
        if (!runtime.getState().isTerminal) {
          setTransferPairingRuntimeError(runtime, appError);
          runtime.transition('transfer_failed');
        }
        throw AppError.from(appError);
      } finally {
        connectedEncryptedKey = '';

        if (decryptedBuffer) {
          secureWipe(decryptedBuffer);
        }
        if (encryptedBuffer) {
          secureWipe(encryptedBuffer);
        }

        clearTransferData(transferData);
      }
    },
  };

  const moduleGetter = async (moduleName: string) => {
    if (moduleName !== 'api') {
      throw createTransferPayloadError(
        `Unknown App Transfer module: ${moduleName}`,
      );
    }

    return api;
  };

  const callRemoteApiMethod = buildCallRemoteApiMethod<IJsonRpcRequest>(
    moduleGetter,
    'e2eeClientToClientApi',
  );

  const _bridge = new JsBridgeE2EEClientToClient(
    {
      receiveHandler: async (payload) => {
        const request = payload.data as IJsonRpcRequest;
        const result = await callRemoteApiMethod(request);
        return result as unknown;
      },
    },
    {
      socket: socket as never,
      roomId,
      isProxySide: false,
    },
  );

  return {
    dispose,
  };
}
