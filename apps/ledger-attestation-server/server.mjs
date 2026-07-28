import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  ApduResponse,
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  GeneralDmkError,
  GenuineCheckDeviceAction,
  TransportConnectedDevice,
  UnknownDeviceError,
} = require('@ledgerhq/device-management-kit');
const { Left, Right } = require('purify-ts');
const { firstValueFrom, of, take, timeout } = require('rxjs');
const { WebSocket, WebSocketServer } = require('ws');

const HOST = process.env.ONEKEY_LEDGER_ATTESTATION_HOST || '127.0.0.1';
const PORT = Number(process.env.ONEKEY_LEDGER_ATTESTATION_PORT || 49271);
const PATH = '/v1/ledger/attestation';
const TRANSPORT_ID = 'ONEKEY_LEDGER_ATTESTATION_RELAY';
const PROTOCOL_VERSION = 1;
const MAX_APDU_BYTES = 8 * 1024;
const MAX_APDU_EXCHANGES = 256;
const GENUINE_CHECK_TIMEOUT_MS = 5 * 60_000;
const LEDGER_MODEL_IDS = new Set([
  'nanoS',
  'nanoSP',
  'nanoX',
  'stax',
  'flex',
  'apexp',
]);

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function parseHex(value, field, exactBytes) {
  if (
    typeof value !== 'string' ||
    value.length % 2 !== 0 ||
    !/^[0-9a-f]*$/i.test(value) ||
    value.length / 2 > MAX_APDU_BYTES ||
    (exactBytes !== undefined && value.length !== exactBytes * 2)
  ) {
    throw new Error(`Invalid Ledger relay ${field}`);
  }
  return value.toLowerCase();
}

function parseClientMessage(raw) {
  if (Buffer.byteLength(raw, 'utf8') > MAX_APDU_BYTES * 2 + 4096) {
    throw new Error('Ledger relay message is too large');
  }
  const message = JSON.parse(raw);
  if (!message || typeof message !== 'object') {
    throw new Error('Invalid Ledger relay message');
  }
  if (message.type === 'hello') {
    const device = message.device;
    if (
      message.protocolVersion !== PROTOCOL_VERSION ||
      !device ||
      typeof device.id !== 'string' ||
      device.id.length < 1 ||
      device.id.length > 128 ||
      !LEDGER_MODEL_IDS.has(device.modelId) ||
      (device.connectionType !== undefined &&
        device.connectionType !== 'USB' &&
        device.connectionType !== 'BLE')
    ) {
      throw new Error('Invalid Ledger relay hello');
    }
    return message;
  }
  if (message.type !== 'apdu-response' && message.type !== 'apdu-error') {
    throw new Error('Unsupported Ledger relay message');
  }
  if (
    typeof message.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(message.requestId)
  ) {
    throw new Error('Invalid Ledger relay requestId');
  }
  if (message.type === 'apdu-error') {
    if (
      typeof message.message !== 'string' ||
      message.message.length < 1 ||
      message.message.length > 512
    ) {
      throw new Error('Invalid Ledger relay APDU error');
    }
    return message;
  }
  return {
    ...message,
    dataHex: parseHex(message.dataHex, 'dataHex'),
    statusCodeHex: parseHex(message.statusCodeHex, 'statusCodeHex', 2),
  };
}

function createApduBridge(socket) {
  let pending;
  let exchangeCount = 0;

  const rejectPending = (error) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.reject(error);
    pending = undefined;
  };

  return {
    exchangeApdu(apdu, timeoutMs = 30_000) {
      if (socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error('Ledger relay client disconnected'));
      }
      if (pending) {
        return Promise.reject(
          new Error('Ledger relay permits only one outstanding APDU'),
        );
      }
      if (apdu.byteLength > MAX_APDU_BYTES) {
        return Promise.reject(new Error('Ledger relay APDU is too large'));
      }
      exchangeCount += 1;
      if (exchangeCount > MAX_APDU_EXCHANGES) {
        return Promise.reject(
          new Error('Ledger relay APDU exchange limit exceeded'),
        );
      }
      const requestId = randomUUID();
      const boundedTimeout = Math.max(1000, Math.min(timeoutMs, 60_000));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending = undefined;
          reject(new Error('Ledger relay APDU timed out'));
        }, boundedTimeout);
        pending = { requestId, resolve, reject, timer };
        send(socket, {
          type: 'apdu-request',
          requestId,
          apduHex: Buffer.from(apdu).toString('hex'),
          timeoutMs: boundedTimeout,
        });
      });
    },
    handle(message) {
      if (!pending || pending.requestId !== message.requestId) {
        throw new Error('Ledger relay APDU response is out of order');
      }
      const current = pending;
      pending = undefined;
      clearTimeout(current.timer);
      if (message.type === 'apdu-error') {
        current.reject(new Error(message.message));
      } else {
        current.resolve({
          data: Uint8Array.from(Buffer.from(message.dataHex, 'hex')),
          statusCode: Uint8Array.from(
            Buffer.from(message.statusCodeHex, 'hex'),
          ),
        });
      }
    },
    close(error) {
      rejectPending(error);
    },
  };
}

function createRelayTransportFactory({ bridge, device }) {
  return (args) => {
    const deviceModel = args.deviceModelDataSource.getDeviceModel({
      id: device.modelId,
    });
    const discoveredDevice = {
      id: device.id,
      deviceModel,
      transport: TRANSPORT_ID,
      name: device.name,
    };
    let connectedDevice;

    return {
      getIdentifier: () => TRANSPORT_ID,
      isSupported: () => true,
      startDiscovering: () => of(discoveredDevice),
      stopDiscovering: () => undefined,
      listenToAvailableDevices: () => of([discoveredDevice]),
      connect: async ({ deviceId }) => {
        if (deviceId !== device.id) {
          return Left(new UnknownDeviceError());
        }
        if (!connectedDevice) {
          connectedDevice = new TransportConnectedDevice({
            id: device.id,
            deviceModel,
            type: device.connectionType || 'USB',
            transport: TRANSPORT_ID,
            name: device.name,
            sendApdu: async (apdu, _triggersDisconnection, abortTimeout) => {
              try {
                return Right(
                  new ApduResponse(
                    await bridge.exchangeApdu(apdu, abortTimeout),
                  ),
                );
              } catch (error) {
                return Left(new GeneralDmkError(error));
              }
            },
          });
        }
        return Right(connectedDevice);
      },
      disconnect: async () => {
        connectedDevice = undefined;
        return Right(undefined);
      },
    };
  };
}

async function runServerOwnedGenuineCheck(bridge, device) {
  const dmk = new DeviceManagementKitBuilder()
    .addTransport(createRelayTransportFactory({ bridge, device }))
    .build();
  let sessionId;
  try {
    const discoveredDevice = await firstValueFrom(
      dmk
        .startDiscovering({ transport: TRANSPORT_ID })
        .pipe(take(1), timeout({ first: 5000 })),
    );
    sessionId = await dmk.connect({
      device: discoveredDevice,
      sessionRefresherOptions: { isRefresherDisabled: true },
    });
    const action = dmk.executeDeviceAction({
      sessionId,
      deviceAction: new GenuineCheckDeviceAction({ input: {} }),
    });
    let deviceId;

    return await new Promise((resolve, reject) => {
      let settled = false;
      let timer;
      let subscription;
      const settle = (callback) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subscription?.unsubscribe();
        callback();
      };
      timer = setTimeout(() => {
        settle(() => {
          action.cancel();
          reject(new Error('Ledger server Genuine Check timed out'));
        });
      }, GENUINE_CHECK_TIMEOUT_MS);
      subscription = action.observable.subscribe({
        next: (state) => {
          if (state.status === DeviceActionStatus.Pending) {
            const intermediate = state.intermediateValue;
            if (intermediate?.deviceId instanceof Uint8Array && !deviceId) {
              deviceId = Buffer.from(intermediate.deviceId).toString('hex');
            }
            return;
          }
          if (state.status === DeviceActionStatus.Completed) {
            settle(() => {
              const isGenuine = state.output?.isGenuine === true;
              if (isGenuine && !/^[0-9a-f]{64}$/i.test(deviceId || '')) {
                reject(
                  new Error(
                    'Ledger server Genuine Check succeeded without a valid physical-device DSID',
                  ),
                );
                return;
              }
              resolve({
                isGenuine,
                deviceId: isGenuine ? deviceId.toLowerCase() : undefined,
              });
            });
            return;
          }
          if (state.status === DeviceActionStatus.Error) {
            settle(() => reject(state.error));
          }
        },
        error: (error) => settle(() => reject(error)),
      });
    });
  } finally {
    try {
      await dmk.stopDiscovering();
    } catch {
      // Discovery may already be stopped after the first device.
    }
    if (sessionId) {
      try {
        await dmk.disconnect({ sessionId });
      } catch {
        // Best-effort after the authoritative result was decided.
      }
    }
    dmk.close();
  }
}

function handleAttestation(socket) {
  const bridge = createApduBridge(socket);
  let started = false;
  let finished = false;

  const fail = (error) => {
    if (finished) return;
    finished = true;
    const normalized =
      error instanceof Error ? error : new Error(String(error));
    bridge.close(normalized);
    send(socket, {
      type: 'error',
      code: 'ledger_attestation_failed',
      message: normalized.message,
    });
    socket.close(1011, 'attestation-failed');
    console.error('[ledger-attestation] failed:', normalized.message);
  };

  socket.on('message', (raw) => {
    try {
      const message = parseClientMessage(raw.toString());
      if (!started) {
        if (message.type !== 'hello') {
          throw new Error('Ledger relay expected hello first');
        }
        started = true;
        send(socket, { type: 'ready', protocolVersion: PROTOCOL_VERSION });
        console.log(
          `[ledger-attestation] connected ${message.device.modelId} (${message.device.connectionType || 'USB'})`,
        );
        void runServerOwnedGenuineCheck(bridge, message.device).then(
          (result) => {
            if (finished) return;
            finished = true;
            const voucherCode = result.isGenuine
              ? `DEV-LOCAL-LEDGER-${randomBytes(4)
                  .toString('hex')
                  .toUpperCase()}`
              : undefined;
            send(socket, { type: 'result', ...result, voucherCode });
            socket.close(1000, 'complete');
            console.log(
              `[ledger-attestation] isGenuine=${String(
                result.isGenuine,
              )} deviceId=${result.deviceId || '(none)'}`,
            );
          },
          fail,
        );
        return;
      }
      bridge.handle(message);
    } catch (error) {
      fail(error);
    }
  });
  socket.on('close', () => {
    if (!finished) {
      fail(new Error('Ledger relay client disconnected'));
    }
  });
  socket.on('error', fail);
}

const httpServer = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        ok: true,
        mode: 'ledger-server-owned-dmk-genuine-check',
      }),
    );
    return;
  }
  response.writeHead(404).end();
});

const webSocketServer = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (request, socket, head) => {
  if (request.url !== PATH) {
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    handleAttestation(webSocket);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(
    `[ledger-attestation] listening on http://${HOST}:${PORT} (Ledger DMK runs here)`,
  );
});
