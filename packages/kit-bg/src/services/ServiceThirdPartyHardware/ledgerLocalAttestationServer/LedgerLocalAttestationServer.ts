/* eslint-disable no-restricted-syntax */
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

import WebSocket, { WebSocketServer } from 'ws';

import {
  DEFAULT_LEDGER_RELAY_SESSION_TTL_MS,
  LEDGER_ATTESTATION_RELAY_PROTOCOL_VERSION,
  MAX_LEDGER_RELAY_APDU_BYTES,
  MAX_LEDGER_RELAY_APDU_EXCHANGES,
  parseLedgerRelayClientMessage,
} from './protocol';
import { runLedgerDmkGenuineCheck } from './runLedgerDmkGenuineCheck';

import type { AddressInfo } from 'node:net';
import type {
  ILedgerRelayClientMessage,
  ILedgerRelayDevice,
  ILedgerRelayServerMessage,
} from './protocol';
import type {
  ILedgerRelayApduBridge,
  ILedgerRelayApduResponse,
} from './relayTransport';
import type { ILedgerServerGenuineCheckResult } from './runLedgerDmkGenuineCheck';

interface IRelaySession {
  expiresAt: number;
  consumed: boolean;
  expiryTimer: ReturnType<typeof setTimeout>;
  resolve: (result: ILedgerServerGenuineCheckResult) => void;
  reject: (error: Error) => void;
}

interface IPendingApdu {
  requestId: string;
  resolve: (response: ILedgerRelayApduResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface ILedgerAttestationRelayTicket {
  webSocketUrl: string;
  expiresAt: number;
  result: Promise<ILedgerServerGenuineCheckResult>;
}

export type IRunLedgerServerGenuineCheck = (
  bridge: ILedgerRelayApduBridge,
  device: ILedgerRelayDevice,
) => Promise<ILedgerServerGenuineCheckResult>;

const sendMessage = (socket: WebSocket, message: ILedgerRelayServerMessage) => {
  socket.send(JSON.stringify(message));
};

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export class LedgerLocalAttestationServer {
  private readonly sessions = new Map<string, IRelaySession>();

  private constructor(
    private readonly httpServer: ReturnType<typeof createServer>,
    private readonly webSocketServer: WebSocketServer,
    private readonly baseUrl: string,
    private readonly sessionTtlMs: number,
    private readonly runGenuineCheck: IRunLedgerServerGenuineCheck,
  ) {
    webSocketServer.on('connection', (socket, request) => {
      this.handleConnection(socket, request.url ?? '/');
    });
  }

  static async listen(options?: {
    host?: string;
    port?: number;
    sessionTtlMs?: number;
    runGenuineCheck?: IRunLedgerServerGenuineCheck;
  }): Promise<LedgerLocalAttestationServer> {
    const host = options?.host ?? '127.0.0.1';
    const httpServer = createServer();
    const webSocketServer = new WebSocketServer({
      server: httpServer,
      maxPayload: MAX_LEDGER_RELAY_APDU_BYTES * 2 + 4096,
    });
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(options?.port ?? 0, host, () => {
        httpServer.off('error', reject);
        resolve();
      });
    });
    const address = httpServer.address() as AddressInfo;
    return new LedgerLocalAttestationServer(
      httpServer,
      webSocketServer,
      `ws://${host}:${address.port}`,
      options?.sessionTtlMs ?? DEFAULT_LEDGER_RELAY_SESSION_TTL_MS,
      options?.runGenuineCheck ?? runLedgerDmkGenuineCheck,
    );
  }

  createSession(): ILedgerAttestationRelayTicket {
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.sessionTtlMs;
    let resolve!: (result: ILedgerServerGenuineCheckResult) => void;
    let reject!: (error: Error) => void;
    const result = new Promise<ILedgerServerGenuineCheckResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const expiryTimer = setTimeout(() => {
      const session = this.sessions.get(token);
      if (!session || session.consumed) return;
      this.sessions.delete(token);
      session.reject(new Error('Ledger attestation relay session expired'));
    }, this.sessionTtlMs);
    this.sessions.set(token, {
      expiresAt,
      consumed: false,
      expiryTimer,
      resolve,
      reject,
    });
    return {
      webSocketUrl: `${this.baseUrl}/v1/ledger/attestation/${token}`,
      expiresAt,
      result,
    };
  }

  private handleConnection(socket: WebSocket, rawUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl, this.baseUrl);
    } catch {
      socket.close(4400, 'invalid-url');
      return;
    }
    if (parsed.search || parsed.hash) {
      socket.close(4400, 'invalid-url');
      return;
    }
    const match = parsed.pathname.match(
      /^\/v1\/ledger\/attestation\/([0-9a-f]{64})$/,
    );
    const token = match?.[1];
    if (!token) {
      socket.close(4404, 'session-not-found');
      return;
    }
    const session = this.sessions.get(token);
    if (!session || session.consumed || session.expiresAt <= Date.now()) {
      socket.close(4404, 'session-not-found');
      return;
    }
    session.consumed = true;
    clearTimeout(session.expiryTimer);
    this.sessions.delete(token);
    let helloReceived = false;
    let finished = false;
    let exchangeCount = 0;
    let pendingApdu: IPendingApdu | undefined;

    const fail = (error: unknown, closeCode = 4400) => {
      if (finished) return;
      finished = true;
      const normalized = asError(error);
      if (pendingApdu) {
        clearTimeout(pendingApdu.timer);
        pendingApdu.reject(normalized);
        pendingApdu = undefined;
      }
      session.reject(normalized);
      if (socket.readyState === WebSocket.OPEN) {
        sendMessage(socket, {
          type: 'error',
          code: 'ledger_attestation_failed',
          message: normalized.message,
        });
        socket.close(closeCode, 'attestation-failed');
      }
    };

    const bridge: ILedgerRelayApduBridge = {
      exchangeApdu: (apdu, timeoutMs = 30_000) => {
        if (finished || socket.readyState !== WebSocket.OPEN) {
          return Promise.reject(new Error('Ledger relay client disconnected'));
        }
        if (pendingApdu) {
          return Promise.reject(
            new Error('Ledger relay permits only one outstanding APDU'),
          );
        }
        if (apdu.byteLength > MAX_LEDGER_RELAY_APDU_BYTES) {
          return Promise.reject(new Error('Ledger relay APDU is too large'));
        }
        exchangeCount += 1;
        if (exchangeCount > MAX_LEDGER_RELAY_APDU_EXCHANGES) {
          return Promise.reject(
            new Error('Ledger relay APDU exchange limit exceeded'),
          );
        }
        const requestId = randomUUID();
        return new Promise<ILedgerRelayApduResponse>((resolve, reject) => {
          const boundedTimeout = Math.max(1000, Math.min(timeoutMs, 60_000));
          const timer = setTimeout(() => {
            pendingApdu = undefined;
            reject(new Error('Ledger relay APDU timed out'));
          }, boundedTimeout);
          pendingApdu = { requestId, resolve, reject, timer };
          sendMessage(socket, {
            type: 'apdu-request',
            requestId,
            apduHex: Buffer.from(apdu).toString('hex'),
            timeoutMs: boundedTimeout,
          });
        });
      },
      onInteraction: (requiredUserInteraction) => {
        if (!finished && socket.readyState === WebSocket.OPEN) {
          sendMessage(socket, {
            type: 'interaction',
            requiredUserInteraction,
          });
        }
      },
    };

    const handleClientMessage = (message: ILedgerRelayClientMessage) => {
      if (!helloReceived) {
        if (message.type !== 'hello') {
          throw new Error('Ledger relay expected hello first');
        }
        helloReceived = true;
        sendMessage(socket, {
          type: 'ready',
          protocolVersion: LEDGER_ATTESTATION_RELAY_PROTOCOL_VERSION,
        });
        void this.runGenuineCheck(bridge, message.device).then(
          (result) => {
            if (finished) return;
            if (
              result.isGenuine === true &&
              (!result.deviceId || !/^[0-9a-f]{64}$/i.test(result.deviceId))
            ) {
              fail(
                new Error(
                  'Ledger server Genuine Check succeeded without a valid physical-device DSID',
                ),
              );
              return;
            }
            finished = true;
            const authoritativeResult: ILedgerServerGenuineCheckResult =
              result.isGenuine === true
                ? result
                : { isGenuine: false, deviceId: undefined };
            session.resolve(authoritativeResult);
            sendMessage(socket, {
              type: 'result',
              isGenuine: authoritativeResult.isGenuine,
              deviceId: authoritativeResult.deviceId,
            });
            socket.close(1000, 'complete');
          },
          (error) => fail(error),
        );
        return;
      }
      if (message.type !== 'apdu-response' && message.type !== 'apdu-error') {
        throw new Error('Unexpected Ledger relay message');
      }
      if (!pendingApdu || pendingApdu.requestId !== message.requestId) {
        throw new Error('Ledger relay APDU response is out of order');
      }
      const pending = pendingApdu;
      pendingApdu = undefined;
      clearTimeout(pending.timer);
      if (message.type === 'apdu-error') {
        pending.reject(new Error(message.message));
      } else {
        pending.resolve({
          data: Uint8Array.from(Buffer.from(message.dataHex, 'hex')),
          statusCode: Uint8Array.from(
            Buffer.from(message.statusCodeHex, 'hex'),
          ),
        });
      }
    };

    socket.on('message', (raw) => {
      try {
        handleClientMessage(parseLedgerRelayClientMessage(raw.toString()));
      } catch (error) {
        fail(error);
      }
    });
    socket.on('close', () => {
      if (!finished) {
        fail(new Error('Ledger relay client disconnected'), 4408);
      }
    });
    socket.on('error', (error) => fail(error, 1011));
  }

  async close(): Promise<void> {
    const error = new Error('Ledger attestation relay server closed');
    for (const session of this.sessions.values()) {
      clearTimeout(session.expiryTimer);
      if (!session.consumed) {
        session.reject(error);
      }
    }
    this.sessions.clear();
    for (const socket of this.webSocketServer.clients) {
      socket.close(1001, 'server-closed');
    }
    await new Promise<void>((resolve) => {
      this.webSocketServer.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      this.httpServer.close(() => resolve());
    });
  }
}
