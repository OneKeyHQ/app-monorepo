import { createServer } from 'http';

import cors from 'cors';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

import { e2eeServerApiSetup } from './e2eeServerApi';
import { RoomManager } from './roomManager';

import type {
  IClientToServerEvents,
  IInterServerEvents,
  IServerConfig,
  IServerToClientEvents,
  ISocketData,
} from './types';
import type { Socket } from 'socket.io';

class E2EEServer {
  private app: express.Application;

  private httpServer: ReturnType<typeof createServer>;

  private socketServer: SocketIOServer<
    IClientToServerEvents,
    IServerToClientEvents,
    IInterServerEvents,
    ISocketData
  >;

  private roomManager: RoomManager;

  private config: IServerConfig;

  private corsOptions: cors.CorsOptions;

  constructor() {
    this.config = {
      port: parseInt(process.env.PORT || '3868', 10),
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3868',
        'null',
        'chrome-extension://*',
        'moz-extension://*',
        'ws://*',
        'wss://*',
        'http://*',
        'https://*',
        '*',
      ],
      roomConfig: {
        maxUsers: parseInt(process.env.MAX_USERS_PER_ROOM || '2', 10),
        roomTimeout: parseInt(process.env.ROOM_TIMEOUT || '3600000', 10), // 1 hour
        maxMessageSize: parseInt(
          process.env.MAX_MESSAGE_SIZE || '10485760',
          10,
        ), // 10MB
      },
    };

    this.app = express();
    this.httpServer = createServer(this.app);

    this.setupMiddleware();
    this.setupRoutes();

    this.corsOptions = {
      origin: (origin, callback) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (!origin || this.config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true);
          // callback(new Error('Invalid CORS request'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    };

    this.socketServer = new SocketIOServer<
      IClientToServerEvents,
      IServerToClientEvents,
      IInterServerEvents,
      ISocketData
    >(this.httpServer, {
      cors: this.corsOptions,
      pingTimeout: 60_000,
      pingInterval: 25_000,
      maxHttpBufferSize: this.config.roomConfig.maxMessageSize,
    });

    this.setupSocketEvents();

    this.roomManager = new RoomManager({
      config: this.config.roomConfig,
      socketServer: this.socketServer,
    });
  }

  private setupMiddleware(): void {
    // Error during WebSocket handshake: Unexpected response code: 400
    // {"code":3,"message":"Bad request"}
    // has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
    this.app.use(cors(this.corsOptions));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // /health
    this.app.get('/health', (req, res) => {
      res
        .status(200)
        .json({ message: `Health check OK: ${new Date().toISOString()}` });
    });

    this.app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });
  }

  private setupSocketEvents(): void {
    this.socketServer.on('connection', (socketClient) => {
      e2eeServerApiSetup({
        socketClient,
        roomManager: this.roomManager,
      });

      const instanceId =
        (socketClient.handshake.auth.instanceId as string) || '';

      console.log(
        `[Socket] User connected: ${socketClient.id}, instanceId: ${instanceId}`,
      );

      // TODO remove room when user disconnect
      // TODO remove room before create room

      // Handle disconnection
      socketClient.on('disconnect', async (reason) => {
        console.log(
          `[Socket] User disconnected: ${socketClient.id}, instanceId: ${
            socketClient.data.instanceId || ''
          }, reason: ${reason}`,
        );
        await this.handleUserDisconnect(socketClient);
      });

      // Error handling
      socketClient.on('error', (error) => {
        console.error(`[Socket] Socket error ${socketClient.id}:`, error);
      });
    });
  }

  private async handleUserLeaveRoom(
    socket: Socket,
    roomId?: string,
  ): Promise<void> {
    try {
      const socketData = socket.data as ISocketData | undefined;
      const targetRoomId = roomId || socketData?.roomId;
      const userId = socketData?.userId;

      if (!targetRoomId || !userId) {
        return;
      }

      const result = await this.roomManager.leaveRoom(
        { roomId: targetRoomId, userId },
        { socketClient: socket },
      );

      if (result.success) {
        socket.data = {
          roomId: undefined,
          userId: undefined,
        };

        console.log(`[Socket] User ${userId} left room ${targetRoomId}`);
      }
    } catch (error) {
      console.error('[Socket] Failed to handle user leaving room:', error);
    }
  }

  private async handleUserDisconnect(socket: Socket): Promise<void> {
    try {
      const result = await this.roomManager.leaveRoomBySocket(socket);
      await this.handleUserLeaveRoom(socket);
      if (result.roomId && result.userId) {
        console.log(
          `[Socket] Disconnected user ${result.userId} removed from room ${result.roomId}`,
        );
      }
    } catch (error) {
      console.error('[Socket] Failed to handle user disconnection:', error);
    }
    // remove all event listeners
    socket.removeAllListeners();
  }

  public startServer(): void {
    this.httpServer.listen(this.config.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                E2EE Server                        ║
║                                                          ║
║  🚀 Server started successfully                            ║
║  📡 Port: ${this.config.port.toString().padEnd(49)} ║
║  👥 Max room users: ${this.config.roomConfig.maxUsers.toString().padEnd(37)} ║
║  ⏰ Room timeout: ${Math.floor(this.config.roomConfig.roomTimeout / 60_000)
        .toString()
        .padEnd(43)} minutes ║
║                                                          ║
║  Health check: http://localhost:${this.config.port}/health         ║
╚══════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  private gracefulShutdown(signal: string): void {
    console.log(
      `\n[Server] Received ${signal} signal, starting graceful shutdown...`,
    );

    // Close room manager
    if (this.roomManager) {
      this.roomManager.destroy();
    }

    // Close Socket.IO server
    if (this.socketServer) {
      void this.socketServer.close(() => {
        console.log('[Server] Socket.IO server closed');
      });
    }

    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });
    }

    // Force exit timeout
    setTimeout(() => {
      console.log('[Server] Force exit');
      process.exit(1);
    }, 10_000);
  }
}

// Start server
const server = new E2EEServer();
server.startServer();

export default E2EEServer;
