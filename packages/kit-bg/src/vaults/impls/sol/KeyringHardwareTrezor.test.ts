import bs58 from 'bs58';

import { EMessageTypesSolana } from '@onekeyhq/shared/types/message';

import {
  KeyringHardwareTrezor,
  buildTrezorSolSignTransactionParams,
} from './KeyringHardwareTrezor';

describe('buildTrezorSolSignTransactionParams', () => {
  it('omits additionalInfo when there are no ATA details', () => {
    expect(
      buildTrezorSolSignTransactionParams({
        path: "m/44'/501'/0'/0'",
        serializedTx: 'abcd',
      }),
    ).toEqual({
      path: "m/44'/501'/0'/0'",
      serializedTx: 'abcd',
    });
  });

  it('passes Solana token definition hex when available', () => {
    expect(
      buildTrezorSolSignTransactionParams({
        path: "m/44'/501'/0'/0'",
        serializedTx: 'abcd',
        encodedToken: '010203',
        ataDetails: [
          {
            owner: 'BVRFH6vt5bNXub6WnnFRgaHFTcbkjBrf7x1troU1izGg',
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            mintAddress: '9hayiPmEobVfiTbw5R91StWeQzw9EJGfswLH5o33UDAW',
            associatedTokenAddress:
              'J5rhFGUkeoHVnCvMyqWq1XPjfU1G1hsTh9tTQtST2out',
          },
        ],
      }),
    ).toEqual({
      path: "m/44'/501'/0'/0'",
      serializedTx: 'abcd',
      additionalInfo: {
        encodedToken: '010203',
        tokenAccountsInfos: [
          {
            baseAddress: 'BVRFH6vt5bNXub6WnnFRgaHFTcbkjBrf7x1troU1izGg',
            tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            tokenMint: '9hayiPmEobVfiTbw5R91StWeQzw9EJGfswLH5o33UDAW',
            tokenAccount: 'J5rhFGUkeoHVnCvMyqWq1XPjfU1G1hsTh9tTQtST2out',
          },
        ],
      },
    });
  });
});

describe('KeyringHardwareTrezor Solana OCMS v1 signing', () => {
  it('keeps the selected interaction and returns a base58 signature', async () => {
    const signature = 'ab'.repeat(64);
    const solSignMessage = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareTrezor.prototype),
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
        getBleFallbackOptions: jest.fn(() => ({})),
      },
    ) as KeyringHardwareTrezor;
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
            connectId: 'USB_ID',
            deviceId: 'FEATURES_DEVICE_ID',
          },
          deviceCommonParams: {
            interactionId: 'hwk-trezor-selected',
          },
        },
      } as unknown as Parameters<KeyringHardwareTrezor['signMessage']>[0]),
    ).resolves.toEqual([bs58.encode(Buffer.from(signature, 'hex'))]);
    expect(solSignMessage).toHaveBeenCalledWith(
      'USB_ID',
      'FEATURES_DEVICE_ID',
      {
        knownConnections: [{ transport: 'usb', connectId: 'USB_ID' }],
        interactionId: 'hwk-trezor-selected',
        path: "m/44'/501'/0'/0'",
        message: Buffer.from('Hello, Solana').toString('hex'),
        messageVersion: 1,
        requiredSigners: [Buffer.from(signer).toString('hex')],
      },
    );
  });

  it('serializes multiple messages on the single Trezor protocol pipe', async () => {
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
      Object.create(KeyringHardwareTrezor.prototype),
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
        getBleFallbackOptions: jest.fn(() => ({ replayPolicy: 'never' })),
      },
    ) as KeyringHardwareTrezor;
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
        dbDevice: { connectId: 'USB_ID', deviceId: 'FEATURES_DEVICE_ID' },
      },
    } as unknown as Parameters<KeyringHardwareTrezor['signMessage']>[0]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(solSignMessage).toHaveBeenCalledTimes(1);

    resolveFirst({ success: true, payload: { signature } });
    await expect(pending).resolves.toHaveLength(2);
    expect(solSignMessage).toHaveBeenCalledTimes(2);
  });
});
