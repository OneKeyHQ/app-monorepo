import type { RoomManager } from './roomManager';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

// Socket.IO event type definitions
export interface IServerToClientEvents {
  'room-created': (data: { roomId: string; encryptionKey: string }) => void;
  'room-joined': (data: { roomId: string; userId: string }) => void;
  'user-joined': (data: { userId: string; userCount: number }) => void;
  'user-left': (data: { userId: string; userCount: number }) => void;
  'encrypted-data': (data: {
    encryptedData: string;
    senderId: string;
    timestamp: number;
  }) => void;
  'room-error': (data: { error: string }) => void;
  'room-status': (data: { userCount: number; users: string[] }) => void;
  'room-list': (data: { rooms: IRoomListItem[] }) => void;
}

export interface IClientToServerEvents {
  'e2ee-request': (event: string, payload: IJsBridgeMessagePayload) => void;
  'e2ee-response': (event: string, payload: unknown) => void;

  'create-room': () => void;
  'join-room': (data: { roomId: string; encryptionKey: string }) => void;
  'send-encrypted-data': (data: {
    roomId: string;
    encryptedData: string;
  }) => void;
  'leave-room': (data: { roomId: string }) => void;
  'get-room-status': (data: { roomId: string }) => void;
  'get-room-list': () => void;
}

export interface IInterServerEvents {
  ping: () => void;
}

export interface ISocketData {
  userId?: string;
  roomId?: string;
  instanceId?: string; // Client instance ID
}

// Room data structure
export interface IRoom {
  id: string;
  encryptionKey: string;
  users: Map<string, IE2EESocketUserInfo>;
  transferDirection?:
    | {
        fromUserId: string | undefined;
        toUserId: string | undefined;
      }
    | undefined;
  createdAt: Date;
  lastActivity: Date;
  maxUsers: number;
}

// Room list item
export interface IRoomListItem {
  roomId: string;
  userCount: number;
  maxUsers: number;
  users: string[];
  createdAt: string;
  lastActivity: string;
}

// User information
export interface IE2EESocketUserInfo {
  id: string;
  socketId: string | undefined;
  joinedAt: Date;
  appPlatform: string;
  appPlatformName: string;
  appVersion: string;
  appBuildNumber: string;
  appDeviceName: string;
}

// Encrypted message structure
export interface IEncryptedMessage {
  encryptedData: string;
  senderId: string;
  timestamp: number;
  roomId: string;
}

// Room configuration
export interface IRoomConfig {
  maxUsers: number;
  roomTimeout: number; // Room timeout (milliseconds)
  maxMessageSize: number; // Maximum message size (bytes)
}

// Server configuration
export interface IServerConfig {
  port: number;
  corsOrigins: string[];
  roomConfig: IRoomConfig;
}

// API response type
export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IE2EEServerApi {
  roomManager: RoomManager;
}
export type IE2EEServerApiKeys = keyof IE2EEServerApi;
