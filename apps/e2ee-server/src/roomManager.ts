/* eslint-disable no-restricted-syntax */

import { sortBy } from 'lodash';

import { e2eeApiMethod } from './decorators/e2eeApiMethod';
import cryptoUtils from './utils/cryptoUtils';
import stringUtils from './utils/stringUtils';
import timerUtils from './utils/timerUtils';

import type { IE2EESocketUserInfo, IRoom, IRoomConfig } from './types';
import type { Socket, Server as SocketIOServer } from 'socket.io';

export type IRoomManagerContext = {
  socketClient: Socket;
};

export class RoomManager {
  private rooms: Map<string, IRoom> = new Map();

  private config: IRoomConfig;

  private socketServer: SocketIOServer;

  private cleanupInterval: NodeJS.Timeout | number;

  constructor({
    config,
    socketServer,
  }: {
    config: IRoomConfig;
    socketServer: SocketIOServer;
  }) {
    this.config = config;
    this.socketServer = socketServer;

    // Start cleanup task, clean expired rooms every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRooms();
    }, 5 * 60 * 1000);
  }

  /**
   * Create new room
   * @returns Room information (room ID and encryption key)
   */
  @e2eeApiMethod()
  async createRoom(
    context?: IRoomManagerContext,
  ): Promise<{ roomId: string; encryptionKey: string }> {
    await timerUtils.wait(1000);
    let roomId: string;

    // Generate unique room ID, regenerate if duplicate
    do {
      roomId = cryptoUtils.generateRoomId();

      // If room ID already exists, wait 1 second then regenerate
      if (this.rooms.has(roomId)) {
        console.log(
          `[RoomManager] Room ID ${roomId} already exists, waiting 1 second to regenerate`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } while (this.rooms.has(roomId));

    const encryptionKey = cryptoUtils.generateEncryptionKey();

    const room: IRoom = {
      id: roomId,
      encryptionKey,
      users: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      maxUsers: this.config.maxUsers,
    };

    this.rooms.set(roomId, room);

    console.log(`[RoomManager] Room created: ${roomId}`);
    return { roomId, encryptionKey };
  }

  /**
   * User join room
   * @param roomId Room ID
   * @param encryptionKey Encryption key
   * @param socketId User's Socket ID
   * @returns Join result
   */
  @e2eeApiMethod()
  async joinRoom(
    params: {
      roomId: string;
      appPlatform: string;
      appPlatformName: string;
      appVersion: string;
      appBuildNumber: string;
      appDeviceName: string;
    },
    context?: IRoomManagerContext,
  ): Promise<{
    success: boolean;
    userId?: string;
    roomId?: string;
    roomKey?: string;
    error?: string;
    userCount?: number;
  }> {
    await timerUtils.wait(1000);
    if (!context) {
      throw new Error('context is required');
    }
    const { roomId } = params;
    const socketId = context?.socketClient.id;
    // Validate room ID and key format
    if (!cryptoUtils.isValidRoomId(roomId)) {
      throw new Error('Invalid room ID');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Check if room is full
    if (room.users.size >= room.maxUsers) {
      this.socketServer.to(roomId).emit('room-full', {
        roomId,
        userCount: room.users.size,
      });

      throw new Error('Connection Rejected');
    }

    // Check if user is already in room (by socketId)
    for (const [userId, userInfo] of room.users) {
      if (userInfo.socketId === socketId) {
        return {
          success: true,
          userId,
          roomId,
          roomKey: room.encryptionKey,
          userCount: room.users.size,
        };
      }
    }

    // Create new user
    const userId = cryptoUtils.generateUserId();
    const userInfo: IE2EESocketUserInfo = {
      id: userId,
      socketId,
      joinedAt: new Date(),
      appPlatformName: params.appPlatformName,
      appVersion: params.appVersion,
      appBuildNumber: params.appBuildNumber,
      appPlatform: params.appPlatform,
      appDeviceName: params.appDeviceName,
    };

    room.users.set(userId, userInfo);
    room.lastActivity = new Date();

    console.log(
      `[RoomManager] User ${userId} joined room ${roomId}, current user count: ${room.users.size}`,
    );

    await context?.socketClient.join(roomId);

    return {
      success: true,
      userId,
      roomId,
      userCount: room.users.size,
      roomKey: room.encryptionKey,
    };
  }

  /**
   * User leave room
   * @param roomId Room ID
   * @param userId User ID
   * @returns Leave result
   */
  @e2eeApiMethod()
  async leaveRoom(
    params: { roomId: string; userId: string },
    context?: IRoomManagerContext,
  ): Promise<{
    success: boolean;
    userCount?: number;
    roomDestroyed?: boolean;
  }> {
    if (!context) {
      throw new Error('context is required');
    }

    const { roomId, userId } = params;
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const socketValidation = this.isUserInRoom(
      roomId,
      context?.socketClient.id,
    );
    if (!socketValidation.isInRoom) {
      throw new Error('Socket must be in the room');
    }

    if (socketValidation.userId !== userId) {
      throw new Error('User not found');
    }

    const userRemoved = room.users.delete(userId);
    if (!userRemoved) {
      throw new Error('User not found');
    }

    room.lastActivity = new Date();

    console.log(
      `[RoomManager] User ${userId} left room ${roomId}, remaining users: ${room.users.size}`,
    );

    await context.socketClient.leave(roomId);

    this.socketServer.to(roomId).emit('user-left', {
      roomId,
      userId,
      userCount: room.users.size,
    });

    // If room is empty, delete room
    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      console.log(`[RoomManager] Empty room deleted: ${roomId}`);
      return { success: true, userCount: 0, roomDestroyed: true };
    }

    return { success: true, userCount: room.users.size, roomDestroyed: false };
  }

  /**
   * Leave room by Socket ID (for connection disconnect)
   * @param socketId Socket ID
   * @returns Information of left room
   */
  async leaveRoomBySocket(socket: Socket): Promise<{
    roomId?: string;
    userId?: string;
    userCount?: number;
    roomDestroyed?: boolean;
  }> {
    for (const [roomId, room] of this.rooms) {
      for (const [userId, userInfo] of room.users) {
        if (userInfo.socketId === socket.id) {
          try {
            await this.leaveRoom({ roomId, userId }, { socketClient: socket });
          } catch (error) {
            console.error('leaveRoomBySocket error', error);
          }
        }
      }
    }
    return {};
  }

  /**
   * Get complete information of all users in specified room
   * @param roomId Room ID
   * @returns User information list
   */
  @e2eeApiMethod()
  async getRoomUsers(
    { roomId }: { roomId: string },
    context?: IRoomManagerContext,
  ): Promise<IE2EESocketUserInfo[]> {
    if (!context) {
      throw new Error('context is required');
    }
    console.log('getRoomUsers>>>>', roomId);
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log('getRoomUsers>>>> room not found');
      return [];
    }
    // Validate that the socket is in the room
    const socketValidation = this.isUserInRoom(roomId, context.socketClient.id);
    if (!socketValidation.isInRoom) {
      throw new Error('Socket must be in the room to set transfer direction');
    }

    const users: IE2EESocketUserInfo[] = sortBy(
      Array.from(room.users.values()),
      (item) => item.joinedAt.getTime(),
    );
    console.log('getRoomUsers>>>> users', users.length);
    return users.map((item) => ({
      ...item,
      socketId: undefined,
    }));
  }

  @e2eeApiMethod()
  async startTransfer(
    {
      roomId,
      fromUserId,
      toUserId,
    }: {
      roomId: string;
      fromUserId: string;
      toUserId: string;
    },
    context?: IRoomManagerContext,
  ) {
    if (!context) {
      throw new Error('context is required');
    }
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Validate that the socket is in the room
    const socketValidation = this.isUserInRoom(roomId, context.socketClient.id);
    if (!socketValidation.isInRoom) {
      throw new Error('Socket must be in the room to set transfer direction');
    }

    // Validate that both users are in the room
    const fromUserExists = room.users.has(fromUserId);
    const toUserExists = room.users.has(toUserId);

    if (!fromUserExists || !toUserExists) {
      throw new Error('Both fromUser and toUser must be in the room');
    }

    if (fromUserId === toUserId) {
      room.transferDirection = undefined;
    } else {
      room.transferDirection = { fromUserId, toUserId };

      // Generate random number and ensure it's not repeated digits
      let randomNumber: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        randomNumber = stringUtils.randomString(6, {
          chars: stringUtils.randomStringCharsSet.numberOnly,
        });
        attempts += 1;
      } while (this.isRepeatedDigits(randomNumber) && attempts < maxAttempts);

      // If we couldn't generate a valid random number after max attempts, use a fallback
      if (this.isRepeatedDigits(randomNumber)) {
        // Fallback: ensure at least one digit is different
        const digits = randomNumber.split('');
        digits[1] =
          digits[1] === '0' ? '1' : (parseInt(digits[1], 10) + 1).toString();
        randomNumber = digits.join('');
      }

      this.socketServer.to(roomId).emit('start-transfer', {
        roomId,
        fromUserId,
        toUserId,
        randomNumber,
      });
    }
    return room.transferDirection;
  }

  /**
   * Check if a number string contains repeated digits
   * @param numberStr Number string to check
   * @returns True if all digits are the same
   */
  private isRepeatedDigits(numberStr: string): boolean {
    if (!numberStr || numberStr.length === 0) return false;
    const firstDigit = numberStr[0];
    return numberStr.split('').every((digit) => digit === firstDigit);
  }

  /**
   * Validate if user is in specified room
   * @param roomId Room ID
   * @param socketId Socket ID
   * @returns Validation result
   */
  isUserInRoom(
    roomId: string,
    socketId: string,
  ): {
    isInRoom: boolean;
    userId?: string;
  } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { isInRoom: false };
    }

    for (const [userId, userInfo] of room.users) {
      if (userInfo.socketId === socketId) {
        return { isInRoom: true, userId };
      }
    }

    return { isInRoom: false };
  }

  /**
   * Update room activity time
   * @param roomId Room ID
   */
  updateRoomActivity(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.lastActivity = new Date();
    }
  }

  /**
   * Clean up expired rooms
   */
  private cleanupExpiredRooms(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [roomId, room] of this.rooms) {
      const timeSinceActivity = now.getTime() - room.lastActivity.getTime();

      if (timeSinceActivity > this.config.roomTimeout) {
        this.rooms.delete(roomId);
        cleanedCount += 1;
        console.log(`[RoomManager] Expired room cleaned: ${roomId}`);
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `[RoomManager] Cleaned ${cleanedCount} expired rooms this time`,
      );
    }
  }

  /**
   * Destroy room manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rooms.clear();
    console.log('[RoomManager] Room manager destroyed');
  }
}
