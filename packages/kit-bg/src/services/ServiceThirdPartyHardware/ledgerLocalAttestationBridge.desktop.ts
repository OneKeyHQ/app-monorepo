import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  ILedgerAttestationBridgeAdapter,
  ILedgerAttestationBridgeContext,
  ILedgerLocalAttestationResult,
} from './ledgerLocalAttestationBridge';

const LEDGER_LOCAL_ATTESTATION_URL =
  'ws://127.0.0.1:49271/v1/ledger/attestation';
const LEDGER_LOCAL_ATTESTATION_TIMEOUT_MS = 5 * 60_000;

type ILedgerRelayServerMessage =
  | {
      type: 'ready';
      protocolVersion: 1;
    }
  | {
      type: 'apdu-request';
      requestId: string;
      apduHex: string;
      timeoutMs: number;
    }
  | {
      type: 'result';
      isGenuine: boolean;
      deviceId?: string;
      voucherCode?: string;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    };

function runRelaySession(
  bridge: ILedgerAttestationBridgeContext,
): Promise<ILedgerLocalAttestationResult> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(LEDGER_LOCAL_ATTESTATION_URL);
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (error?: Error, result?: ILedgerLocalAttestationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) {
        reject(error);
      } else if (result) {
        resolve(result);
      }
    };
    timer = setTimeout(() => {
      finish(new OneKeyLocalError('Local Ledger attestation server timed out'));
    }, LEDGER_LOCAL_ATTESTATION_TIMEOUT_MS);

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          device: bridge.device,
        }),
      );
    });
    socket.addEventListener('message', (event) => {
      let message: ILedgerRelayServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ILedgerRelayServerMessage;
      } catch {
        finish(new OneKeyLocalError('Invalid local Ledger server response'));
        return;
      }
      if (message.type === 'error') {
        finish(new OneKeyLocalError(message.message));
        return;
      }
      if (message.type === 'result') {
        if (
          message.isGenuine &&
          (!message.deviceId ||
            !/^[0-9a-f]{64}$/i.test(message.deviceId) ||
            !message.voucherCode)
        ) {
          finish(
            new OneKeyLocalError(
              'Local Ledger server returned an incomplete genuine result',
            ),
          );
          return;
        }
        finish(undefined, message);
        return;
      }
      if (message.type !== 'apdu-request') {
        return;
      }
      void bridge.exchangeApdu(message.apduHex, message.timeoutMs).then(
        (response) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          socket.send(
            JSON.stringify({
              type: 'apdu-response',
              requestId: message.requestId,
              dataHex: response.dataHex,
              statusCodeHex: response.statusCodeHex,
            }),
          );
        },
        (error) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          socket.send(
            JSON.stringify({
              type: 'apdu-error',
              requestId: message.requestId,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        },
      );
    });
    socket.addEventListener('error', () => {
      finish(
        new OneKeyLocalError(
          'Local Ledger attestation server is not running. Start `yarn dev:ledger-attestation-server`.',
        ),
      );
    });
    socket.addEventListener('close', (event) => {
      if (!settled && event.code !== 1000) {
        finish(
          new OneKeyLocalError(
            `Local Ledger attestation server disconnected (${event.code})`,
          ),
        );
      }
    });
  });
}

export async function runLedgerLocalServerAttestation({
  hw,
  connectId,
}: {
  hw: ILedgerAttestationBridgeAdapter;
  connectId: string;
}): Promise<ILedgerLocalAttestationResult> {
  const response = await hw.runDeviceAttestationApduBridge(
    connectId,
    runRelaySession,
  );
  if (!response.success) {
    throw new OneKeyLocalError(response.payload.error);
  }
  return response.payload;
}
