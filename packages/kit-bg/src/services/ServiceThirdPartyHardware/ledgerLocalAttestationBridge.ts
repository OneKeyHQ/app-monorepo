import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export type ILedgerLocalAttestationResult = {
  isGenuine: boolean;
  deviceId?: string;
  voucherCode?: string;
};

export type ILedgerAttestationBridgeContext = {
  device: {
    id: string;
    modelId: 'nanoS' | 'nanoSP' | 'nanoX' | 'stax' | 'flex' | 'apexp';
    name?: string;
    connectionType?: 'USB' | 'BLE';
  };
  exchangeApdu: (
    apduHex: string,
    timeoutMs?: number,
  ) => Promise<{ dataHex: string; statusCodeHex: string }>;
};

export type ILedgerAttestationBridgeAdapter = {
  runDeviceAttestationApduBridge: <T>(
    connectId: string,
    run: (bridge: ILedgerAttestationBridgeContext) => Promise<T>,
  ) => Promise<
    | { success: true; payload: T }
    | {
        success: false;
        payload: {
          error: string;
          code: number;
          params?: Record<string, unknown>;
        };
      }
  >;
};

export async function runLedgerLocalServerAttestation(_params: {
  hw: ILedgerAttestationBridgeAdapter;
  connectId: string;
}): Promise<ILedgerLocalAttestationResult> {
  throw new OneKeyLocalError(
    'The local Ledger attestation server demo is available only in OneKey Desktop',
  );
}
