import {
  type ILedgerRelayClientMessage,
  type ILedgerRelayServerMessage,
  type IRunLedgerServerGenuineCheck,
  LedgerLocalAttestationServer,
} from './ledgerLocalAttestationServer';
import WebSocket from 'ws';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  ILedgerAttestationBridgeAdapter,
  ILedgerLocalAttestationResult,
} from './ledgerLocalAttestationBridge';

function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
}

export async function runLedgerLocalServerAttestation({
  hw,
  connectId,
  serverRunGenuineCheck,
}: {
  hw: ILedgerAttestationBridgeAdapter;
  connectId: string;
  /**
   * Test seam only. The background service never accepts or forwards a
   * renderer-supplied runner, so production verdict ownership stays local.
   */
  serverRunGenuineCheck?: IRunLedgerServerGenuineCheck;
}): Promise<ILedgerLocalAttestationResult> {
  const server = await LedgerLocalAttestationServer.listen({
    host: '127.0.0.1',
    port: 0,
    runGenuineCheck: serverRunGenuineCheck,
  });
  try {
    const response = await hw.runDeviceAttestationApduBridge(
      connectId,
      async (bridge) => {
        const ticket = server.createSession();
        const socket = new WebSocket(ticket.webSocketUrl);
        let clientError: Error | undefined;
        socket.on('message', (raw) => {
          let message: ILedgerRelayServerMessage;
          try {
            message = JSON.parse(raw.toString()) as ILedgerRelayServerMessage;
          } catch (error) {
            clientError =
              error instanceof Error ? error : new Error(String(error));
            socket.close(4400, 'invalid-server-message');
            return;
          }
          if (message.type === 'error') {
            clientError = new Error(message.message);
            return;
          }
          if (message.type !== 'apdu-request') {
            return;
          }
          void bridge.exchangeApdu(message.apduHex, message.timeoutMs).then(
            (apduResponse) => {
              if (socket.readyState !== WebSocket.OPEN) {
                return;
              }
              socket.send(
                JSON.stringify({
                  type: 'apdu-response',
                  requestId: message.requestId,
                  dataHex: apduResponse.dataHex,
                  statusCodeHex: apduResponse.statusCodeHex,
                } satisfies ILedgerRelayClientMessage),
              );
            },
            (error) => {
              if (socket.readyState !== WebSocket.OPEN) {
                return;
              }
              socket.send(
                JSON.stringify({
                  type: 'apdu-error',
                  requestId: message.requestId,
                  message:
                    error instanceof Error ? error.message : String(error),
                } satisfies ILedgerRelayClientMessage),
              );
            },
          );
        });
        await waitForOpen(socket);
        socket.send(
          JSON.stringify({
            type: 'hello',
            protocolVersion: 1,
            device: bridge.device,
          } satisfies ILedgerRelayClientMessage),
        );
        try {
          const result = await ticket.result;
          if (clientError) {
            throw clientError;
          }
          return result;
        } finally {
          socket.close(1000, 'client-complete');
        }
      },
    );
    if (!response.success) {
      throw new OneKeyLocalError(response.payload.error);
    }
    return response.payload;
  } finally {
    await server.close();
  }
}
