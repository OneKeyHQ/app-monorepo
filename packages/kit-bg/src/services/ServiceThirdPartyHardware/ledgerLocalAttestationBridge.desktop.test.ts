import { runLedgerLocalServerAttestation } from './ledgerLocalAttestationBridge.desktop';

import type {
  ILedgerAttestationBridgeAdapter,
  ILedgerAttestationBridgeContext,
} from './ledgerLocalAttestationBridge';

describe('runLedgerLocalServerAttestation', () => {
  it('keeps the DMK verdict server-side while forwarding physical-device APDUs', async () => {
    const apduHexes: string[] = [];
    const runBridge = jest.fn();
    const hw: ILedgerAttestationBridgeAdapter = {
      runDeviceAttestationApduBridge: async <T>(
        connectId: string,
        run: (bridge: ILedgerAttestationBridgeContext) => Promise<T>,
      ) => {
        runBridge(connectId, run);
        const payload = await run({
          device: {
            id: 'physical-ledger',
            modelId: 'nanoX',
            connectionType: 'USB',
          },
          exchangeApdu: async (apduHex) => {
            apduHexes.push(apduHex);
            return { dataHex: 'abcd', statusCodeHex: '9000' };
          },
        });
        return { success: true as const, payload };
      },
    };

    await expect(
      runLedgerLocalServerAttestation({
        hw,
        connectId: 'ledger-connect-id',
        serverRunGenuineCheck: async (bridge) => {
          const response = await bridge.exchangeApdu(
            Uint8Array.from([0xe0, 0x01, 0x00, 0x00, 0x00]),
            2000,
          );
          expect(Buffer.from(response.data).toString('hex')).toBe('abcd');
          expect(Buffer.from(response.statusCode).toString('hex')).toBe('9000');
          return { isGenuine: true, deviceId: 'ab'.repeat(32) };
        },
      }),
    ).resolves.toEqual({
      isGenuine: true,
      deviceId: 'ab'.repeat(32),
    });
    expect(runBridge).toHaveBeenCalledWith(
      'ledger-connect-id',
      expect.any(Function),
    );
    expect(apduHexes).toEqual(['e001000000']);
  });
});
