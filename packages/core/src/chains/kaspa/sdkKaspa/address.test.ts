import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import * as encryptor from '@onekeyhq/engine/src/secret/encryptors/aes256';

import { addressFromPublicKey, isValidAddress } from './address';
import { publicKeyFromOriginPubkey } from './publickey';

jest.setTimeout(3 * 60 * 1000);

describe('Kaspa Address Tests', () => {
  it('kaspa address generate', () => {
    // 32 bytes seed
    const encryptedSeed = Buffer.from(
      hexToBytes('12345678901234567890123456789012'),
    );
    const password = '123456';

    const seed: Buffer = encryptor.encrypt(password, encryptedSeed);

    const pathPrefix = "m/44'/1111'";
    const indexes = [0];

    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
      seed,
      password,
      pathPrefix,
      // indexes.map((index) => `${index.toString()}'`),
      indexes.map((index) => `${index.toString()}'/0/0`),
    );

    pubkeyInfos.forEach((pubkeyInfo) => {
      const publicKey = publicKeyFromOriginPubkey(pubkeyInfo.extendedKey.key);
      const address = addressFromPublicKey(publicKey, 'kaspa');
      process.stdout.write(
        `origin publicKey: ${bytesToHex(pubkeyInfo.extendedKey.key)}\n`,
      );

      process.stdout.write(`extendedKey: ${pubkeyInfo.path}\n`);
      process.stdout.write(
        `pubKeyBuffer: ${bytesToHex(publicKey.toBuffer())}\n`,
      );
      process.stdout.write(`address: ${address}\n`);
    });

    process.stdout.write(`pubkeyInfos: ${JSON.stringify(pubkeyInfos)}\n`);
  });

  it('kaspa validate address success', () => {
    const isValid = isValidAddress(
      'kaspa:qpq55rv39sa592frxvklh8kztvm8ntw3gje20xsdw9snqk0gwnqaqvlwewmqa',
      'kaspa',
    );

    expect(isValid).toBe(true);
  });

  it('kaspa validate address error 1', () => {
    const isValid = isValidAddress(
      'bitcoin:qpq55rv39sa592frxvklh8kztvm8ntw3gje20xsdw9snqk0gwnqaqvlwewmqa',
      'kaspa',
    );

    expect(isValid).toBe(false);
  });

  it('kaspa validate address error 2', () => {
    const isValid = isValidAddress(
      'kaspa:qpq55rv39sa592frxvklh8kztvm8ntw3gje20xsdw9snqk0gwnqaqvlwewmq',
      'kaspa',
    );

    expect(isValid).toBe(false);
  });

  it('kaspa validate address error 3', () => {
    const isValid = isValidAddress(
      'kaspa:qpq55rv39sa592frxvklh8kztvm8ntw3gje20xsdw9snqk0gwnqaqvlwewmqb',
      'kaspa',
    );

    expect(isValid).toBe(false);
  });
});

export {};
