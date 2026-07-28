import { firstValueFrom } from 'rxjs';

import { createLedgerRelayTransportFactory } from '../relayTransport';

describe('createLedgerRelayTransportFactory', () => {
  it('adapts a remote APDU bridge to the Ledger DMK TransportFactory contract', async () => {
    const bridge = {
      exchangeApdu: jest.fn(async () => ({
        data: Uint8Array.from([0x12, 0x34]),
        statusCode: Uint8Array.from([0x90, 0x00]),
      })),
    };
    const transport = createLedgerRelayTransportFactory({
      bridge,
      device: { id: 'relay-device', modelId: 'nanoX', name: 'Ledger Nano X' },
    })({
      deviceModelDataSource: {
        getDeviceModel: jest.fn().mockReturnValue({ id: 'nanoX' }),
      },
    } as any);

    await expect(
      firstValueFrom(transport.startDiscovering()),
    ).resolves.toMatchObject({
      id: 'relay-device',
      name: 'Ledger Nano X',
      transport: 'ONEKEY_LEDGER_ATTESTATION_RELAY',
    });
    const connected = await transport.connect({
      deviceId: 'relay-device',
      onDisconnect: jest.fn(),
    });
    expect(connected.isRight()).toBe(true);
    const device = connected.extract() as {
      sendApdu: (apdu: Uint8Array) => Promise<{
        isRight: () => boolean;
        extract: () => { data: Uint8Array; statusCode: Uint8Array };
      }>;
    };
    const response = await device.sendApdu(Uint8Array.from([0xe0, 0x01]));
    expect(response.isRight()).toBe(true);
    expect(response.extract()).toMatchObject({
      data: Uint8Array.from([0x12, 0x34]),
      statusCode: Uint8Array.from([0x90, 0x00]),
    });
  });
});
