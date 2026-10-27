import bs58 from 'bs58';

import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { buildHardwareSolSignOffchainMessageV1Params } from './KeyringHardware';

describe('buildHardwareSolSignOffchainMessageV1Params', () => {
  it('maps the UTF-8 body and sorted signer public keys to Hardware SDK params', () => {
    const signerA = Uint8Array.from({ length: 32 }, (_, index) => index);
    const signerB = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const requiredSigners = [bs58.encode(signerB), bs58.encode(signerA)];

    expect(
      buildHardwareSolSignOffchainMessageV1Params({
        message: 'Hello, Solana',
        messagePayload: { version: 1, requiredSigners },
      }),
    ).toEqual({
      messageHex: Buffer.from('Hello, Solana').toString('hex'),
      messageVersion: 1,
      requiredSigners: [
        Buffer.from(signerA).toString('hex'),
        Buffer.from(signerB).toString('hex'),
      ],
    });
    expect(requiredSigners).toEqual([
      bs58.encode(signerB),
      bs58.encode(signerA),
    ]);
  });

  it('rejects version 0 before building hardware SDK params', () => {
    jest
      .spyOn(appLocale.intl, 'formatMessage')
      .mockReturnValue('Not supported by hardware wallets');

    expect(() =>
      buildHardwareSolSignOffchainMessageV1Params({
        message: 'Hello, Solana',
        messagePayload: { version: 0 },
      }),
    ).toThrow('Not supported by hardware wallets');
  });
});
