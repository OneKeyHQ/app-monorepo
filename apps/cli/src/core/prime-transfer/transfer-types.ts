import type {
  EPrimeTransferDataType,
  EPrimeTransferServerType,
  IE2EESocketUserInfo,
  IPrimeTransferData,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import type { IEndpointEnv } from '../../config';

export const DEFAULT_TRANSFER_PAIRING_TIMEOUT_MS = 120_000;

type ITransferStateEvent =
  | 'pairing_started'
  | 'pairing_verified'
  | 'transfer_receiving'
  | 'transfer_importing'
  | 'transfer_completed'
  | 'transfer_cancelled'
  | 'transfer_timeout'
  | 'transfer_failed';

type ITransferStateStatus =
  | 'pairing'
  | 'paired'
  | 'receiving'
  | 'importing'
  | 'completed'
  | 'cancelled'
  | 'timeout'
  | 'failed';

export interface ITransferStateSnapshot {
  event: ITransferStateEvent;
  status: ITransferStateStatus;
  message: string;
  isTerminal: boolean;
  updatedAt: string;
}

type ITransferStateListener = (state: ITransferStateSnapshot) => void;
type ITransferStatePredicate = (state: ITransferStateSnapshot) => boolean;

export interface ITransferPairingPayload {
  roomId: string;
  transferType: EPrimeTransferDataType;
  serverType: EPrimeTransferServerType;
  websocketEndpoint: string;
  uri: string;
  verifyString: string;
}

export interface ITransferPairingTimeoutWindow {
  startedAt: string;
  expiresAt: string;
}

export interface ITransferPayloadHandlingContext {
  assertSessionIsActive(): void;
}

export interface ITransferPayloadHandlingResult {
  rollback?(): Promise<void>;
}

export interface ITransferPairingSession {
  status: 'pairing';
  loginMethod: 'app_transfer';
  pairingCode: string;
  createdAt: string;
  timeoutMs: number;
  expiresAt: string;
  pairingPayload: ITransferPairingPayload;
}

export interface ICreateTransferPairingSessionParams {
  endpointEnv?: IEndpointEnv;
  timeoutMs?: number;
  transferType?: EPrimeTransferDataType;
  serverType?: EPrimeTransferServerType;
  customServerUrl?: string;
}

export interface ITransferRoomJoinParams {
  appPlatformName: string;
  appVersion: string;
  appBuildNumber: string;
  appPlatform: string;
  appDeviceName: string;
}

export interface ITransferJoinRoomAfterCreateParams extends ITransferRoomJoinParams {
  roomId: string;
}

export interface ITransferSocketLike {
  connected: boolean;
  emit(event: string, ...args: unknown[]): boolean;
  on(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  listeners(event: string): Array<(...args: unknown[]) => void>;
  disconnect(): this;
}

type ITransferPayloadHandler = (
  transferData: IPrimeTransferData,
  context: ITransferPayloadHandlingContext,
) => Promise<ITransferPayloadHandlingResult | void>;

export interface ITransferRoomManager {
  createRoom(): Promise<{ roomId: string }>;
  joinRoomAfterCreate(
    params: ITransferJoinRoomAfterCreateParams,
  ): Promise<{ roomId: string; userId: string }>;
  leaveRoom(params: {
    roomId: string;
    userId: string;
  }): Promise<{ roomId: string }>;
  getRoomUsers(params: { roomId: string }): Promise<IE2EESocketUserInfo[]>;
}

export interface ITransferServerApi {
  roomManager: ITransferRoomManager;
}

export interface ITransferPairingRuntime {
  roomId: string;
  userId: string;
  pairingCode: string;
  getVerificationCode(): string | null;
  setVerificationCode(code: string | null): void;
  getState(): ITransferStateSnapshot;
  subscribe(listener: ITransferStateListener): () => void;
  transition(event: ITransferStateEvent): ITransferStateSnapshot;
  waitForState(
    predicate: ITransferStatePredicate,
  ): Promise<ITransferStateSnapshot>;
  dispose(): Promise<void>;
}

export interface ITransferReceiverAdapterOptions {
  now?: () => Date;
  connectSocket?: (endpoint: string) => Promise<ITransferSocketLike>;
  createServerApi?: (socket: ITransferSocketLike) => ITransferServerApi;
  replaceActiveSession?: (
    runtime: ITransferPairingRuntime | null,
  ) => Promise<void> | void;
  getDeviceInfo?: () => ITransferRoomJoinParams;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  roomUsersPollIntervalMs?: number;
}

export type {
  ITransferPayloadHandler as TransferPayloadHandler,
  ITransferStateEvent as TransferStateEvent,
  ITransferStateListener as TransferStateListener,
  ITransferStatePredicate as TransferStatePredicate,
  ITransferStateStatus as TransferStateStatus,
};
