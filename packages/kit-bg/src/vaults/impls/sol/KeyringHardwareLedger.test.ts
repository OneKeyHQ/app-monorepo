import bs58 from 'bs58';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EMessageTypesSolana } from '@onekeyhq/shared/types/message';

import { KeyringHardwareLedger } from './KeyringHardwareLedger';

jest.mock('../../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

describe('KeyringHardwareLedger Solana OCMS v1 signing', () => {
  it('uses the interaction-bound session and the stored seed fingerprint', async () => {
    const signature = 'ab'.repeat(64);
    const solSignMessage = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareLedger.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              hw: { solSignMessage },
            }),
          },
        },
        vault: {
          getAccountPath: jest.fn().mockResolvedValue("m/44'/501'/0'/0'"),
        },
      },
    ) as KeyringHardwareLedger;
    const signer = Uint8Array.from({ length: 32 }, (_, index) => index);

    await expect(
      keyring.signMessage({
        messages: [
          {
            type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
            message: 'Hello, Solana',
            payload: {
              version: 1,
              requiredSigners: [bs58.encode(signer)],
            },
          },
        ],
        deviceParams: {
          dbDevice: {
            id: 'ledger-sol-wallet',
            connectId: '',
            deviceId: '',
            vendor: EHardwareVendor.ledger,
            settingsRaw: JSON.stringify({
              chainFingerprints: { sol: 'trusted-sol-fingerprint' },
            }),
          },
          deviceCommonParams: {
            interactionId: 'hwk-ledger-selected',
          },
        },
      } as unknown as Parameters<KeyringHardwareLedger['signMessage']>[0]),
    ).resolves.toEqual([bs58.encode(Buffer.from(signature, 'hex'))]);
    expect(solSignMessage).toHaveBeenCalledWith(
      'hwk-ledger-selected',
      'trusted-sol-fingerprint',
      {
        knownConnections: [],
        extra: { dbDeviceId: 'ledger-sol-wallet' },
        path: "m/44'/501'/0'/0'",
        message: Buffer.from('Hello, Solana').toString('hex'),
        messageVersion: 1,
        requiredSigners: [Buffer.from(signer).toString('hex')],
      },
    );
  });

  it('serializes multiple messages before they reach the Ledger SDK queue', async () => {
    const signature = 'ab'.repeat(64);
    let resolveFirst: (value: {
      success: true;
      payload: { signature: string };
    }) => void = () => undefined;
    const solSignMessage = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue({ success: true, payload: { signature } });
    const keyring = Object.assign(
      Object.create(KeyringHardwareLedger.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              hw: { solSignMessage },
            }),
          },
        },
        vault: {
          getAccountPath: jest.fn().mockResolvedValue("m/44'/501'/0'/0'"),
        },
      },
    ) as KeyringHardwareLedger;
    const signer = bs58.encode(
      Uint8Array.from({ length: 32 }, (_, index) => index),
    );
    const messages = ['first', 'second'].map((message) => ({
      type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
      message,
      payload: { version: 1, requiredSigners: [signer] },
    }));

    const pending = keyring.signMessage({
      messages,
      deviceParams: {
        dbDevice: {
          id: 'ledger-sol-wallet',
          connectId: '',
          deviceId: '',
          vendor: EHardwareVendor.ledger,
          settingsRaw: JSON.stringify({
            chainFingerprints: { sol: 'trusted-sol-fingerprint' },
          }),
        },
      },
    } as unknown as Parameters<KeyringHardwareLedger['signMessage']>[0]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(solSignMessage).toHaveBeenCalledTimes(1);

    resolveFirst({ success: true, payload: { signature } });
    await expect(pending).resolves.toHaveLength(2);
    expect(solSignMessage).toHaveBeenCalledTimes(2);
  });
});
