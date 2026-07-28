import WebSocket from 'ws';

import {
  type IRunLedgerServerGenuineCheck,
  LedgerLocalAttestationServer,
} from '../LedgerLocalAttestationServer';

import type {
  ILedgerRelayClientMessage,
  ILedgerRelayServerMessage,
} from '../protocol';

const waitForOpen = (socket: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

describe('LedgerLocalAttestationServer', () => {
  let server: LedgerLocalAttestationServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('owns the DMK result while the client only forwards APDUs', async () => {
    const runGenuineCheck: jest.MockedFunction<IRunLedgerServerGenuineCheck> =
      jest.fn(async (bridge, _device) => {
        const response = await bridge.exchangeApdu(
          Uint8Array.from([0xe0, 0x01, 0x00, 0x00, 0x00]),
          2000,
        );
        expect(Buffer.from(response.data).toString('hex')).toBe('abcd');
        expect(Buffer.from(response.statusCode).toString('hex')).toBe('9000');
        return {
          isGenuine: true,
          deviceId: 'ab'.repeat(32),
        };
      });
    server = await LedgerLocalAttestationServer.listen({
      host: '127.0.0.1',
      port: 0,
      runGenuineCheck,
    });
    const ticket = server.createSession();
    const socket = new WebSocket(ticket.webSocketUrl);
    await waitForOpen(socket);

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as ILedgerRelayServerMessage;
      if (message.type === 'apdu-request') {
        socket.send(
          JSON.stringify({
            type: 'apdu-response',
            requestId: message.requestId,
            dataHex: 'abcd',
            statusCodeHex: '9000',
          } satisfies ILedgerRelayClientMessage),
        );
      }
    });
    socket.send(
      JSON.stringify({
        type: 'hello',
        protocolVersion: 1,
        device: {
          id: 'local-ledger',
          modelId: 'nanoX',
          name: 'Ledger Nano X',
        },
      } satisfies ILedgerRelayClientMessage),
    );

    await expect(ticket.result).resolves.toEqual({
      isGenuine: true,
      deviceId: 'ab'.repeat(32),
    });
    expect(runGenuineCheck).toHaveBeenCalledTimes(1);
    expect(runGenuineCheck.mock.calls[0][1]).toMatchObject({
      id: 'local-ledger',
      modelId: 'nanoX',
      name: 'Ledger Nano X',
    });
  });

  it('rejects reuse of a consumed single-use session token', async () => {
    server = await LedgerLocalAttestationServer.listen({
      host: '127.0.0.1',
      port: 0,
      runGenuineCheck: async () => ({
        isGenuine: true,
        deviceId: 'cd'.repeat(32),
      }),
    });
    const ticket = server.createSession();
    const first = new WebSocket(ticket.webSocketUrl);
    await waitForOpen(first);
    first.send(
      JSON.stringify({
        type: 'hello',
        protocolVersion: 1,
        device: { id: 'ledger', modelId: 'nanoX' },
      } satisfies ILedgerRelayClientMessage),
    );
    await ticket.result;

    const second = new WebSocket(ticket.webSocketUrl);
    const closeCode = await new Promise<number>((resolve, reject) => {
      second.once('close', resolve);
      second.once('error', reject);
    });
    expect(closeCode).toBe(4404);
  });

  it('fails closed if a genuine verdict has no valid physical-device DSID', async () => {
    server = await LedgerLocalAttestationServer.listen({
      host: '127.0.0.1',
      port: 0,
      runGenuineCheck: async () => ({
        isGenuine: true,
        deviceId: 'client-controlled-value',
      }),
    });
    const ticket = server.createSession();
    const socket = new WebSocket(ticket.webSocketUrl);
    await waitForOpen(socket);
    socket.send(
      JSON.stringify({
        type: 'hello',
        protocolVersion: 1,
        device: { id: 'ledger', modelId: 'nanoX' },
      } satisfies ILedgerRelayClientMessage),
    );

    await expect(ticket.result).rejects.toThrow('valid physical-device DSID');
  });
});
