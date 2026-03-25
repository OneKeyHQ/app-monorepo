/* eslint-disable max-classes-per-file */
declare module 'miscreant' {
  interface ICryptoProvider {
    importBlockCipherKey(keyData: Uint8Array): Promise<IBlockCipher>;
  }

  interface IBlockCipher {
    clear(): this;
    encryptBlock(block: Uint8Array): Promise<Uint8Array>;
  }

  export class PolyfillCryptoProvider implements ICryptoProvider {
    importBlockCipherKey(keyData: Uint8Array): Promise<IBlockCipher>;
  }

  export class WebCryptoProvider implements ICryptoProvider {
    importBlockCipherKey(keyData: Uint8Array): Promise<IBlockCipher>;
  }

  export class SIV {
    static importKey(
      keyData: Uint8Array,
      algorithm: string,
      provider: ICryptoProvider,
    ): Promise<SIV>;

    seal(
      plaintext: Uint8Array,
      associatedData: Uint8Array[],
    ): Promise<Uint8Array>;

    open(
      ciphertext: Uint8Array,
      associatedData: Uint8Array[],
    ): Promise<Uint8Array>;

    clear(): this;
  }

  export class AEAD {
    static importKey(
      keyData: Uint8Array,
      algorithm: string,
      provider: ICryptoProvider,
    ): Promise<AEAD>;

    seal(
      plaintext: Uint8Array,
      nonce: Uint8Array,
      associatedData?: Uint8Array,
    ): Promise<Uint8Array>;

    open(
      ciphertext: Uint8Array,
      nonce: Uint8Array,
      associatedData?: Uint8Array,
    ): Promise<Uint8Array>;

    clear(): this;
  }
}
