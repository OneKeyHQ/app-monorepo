/* eslint-disable max-classes-per-file */

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { N, decryptAsync, sign, uncompressPublicKey, verify } from '../secret';

import type { ICurveName } from '../types';

export interface IVerifier {
  getPubkey: (compressed?: boolean) => Promise<Buffer>;
  getPubkeyHex: (compressed?: boolean) => Promise<string>;
  verify: (digest: Buffer, signature: Buffer) => Promise<Buffer>;
}

export interface IVerifierPro extends IVerifier {
  verifySignature(params: {
    publicKey: Buffer | Uint8Array | string; // hex string or Buffer
    digest: Buffer | Uint8Array | string; // hex string or Buffer
    signature: Buffer | Uint8Array | string; // hex string or Buffer
  }): Promise<boolean>;
}

export interface ISigner extends IVerifier {
  sign: (digest: Buffer) => Promise<[Buffer, number]>;
  getPrvkey: () => Promise<Buffer>;
  getPrvkeyHex: () => Promise<string>;
}

export class Verifier implements IVerifierPro {
  protected uncompressedPublicKey!: Buffer;
  protected compressedPublicKey!: Buffer;
  protected curve: ICurveName;
  protected initialized: Promise<void>;

  constructor(pub: string, curve: ICurveName) {
    this.curve = curve;
    this.initialized = this.init(pub);
  }

  protected async init(pub: string): Promise<void> {
    if (pub) {
      this.compressedPublicKey = Buffer.from(pub, 'hex');
      this.uncompressedPublicKey = uncompressPublicKey(
        this.curve,
        this.compressedPublicKey,
      );
    }
  }

  async getPubkey(compressed?: boolean): Promise<Buffer> {
    await this.initialized;
    return compressed ? this.compressedPublicKey : this.uncompressedPublicKey;
  }

  async getPubkeyHex(compressed?: boolean): Promise<string> {
    return bufferUtils.bytesToHex(await this.getPubkey(compressed));
  }

  verify() {
    // verify(_digest: Buffer, _signature: Buffer) {
    // Not used.
    return Promise.resolve(Buffer.from([]));
  }

  async verifySignature({
    publicKey,
    digest,
    signature,
  }: {
    publicKey: Buffer | Uint8Array | string; // hex string or Buffer
    digest: Buffer | Uint8Array | string; // hex string or Buffer
    signature: Buffer | Uint8Array | string; // hex string or Buffer
  }): Promise<boolean> {
    await this.initialized;
    const p = bufferUtils.toBuffer(publicKey);
    const d = bufferUtils.toBuffer(digest);
    const s = bufferUtils.toBuffer(signature);
    const { curve } = this;
    return verify(curve, p, d, s);
  }
}

export class ChainSigner extends Verifier implements ISigner {
  private privateKey?: Buffer;

  constructor(
    private encryptedPrivateKey: Buffer,
    private password: string,
    protected override curve: ICurveName,
  ) {
    // Initialize with empty public key, will be set in init()
    super('', curve);
  }

  protected override async init(_pub?: string): Promise<void> {
    this.privateKey = await decryptAsync({
      password: this.password,
      data: this.encryptedPrivateKey,
    });
    const pub = this.privateKey.toString('hex');
    this.compressedPublicKey = Buffer.from(pub, 'hex');
    this.uncompressedPublicKey = uncompressPublicKey(
      this.curve,
      this.compressedPublicKey,
    );
  }

  async getPrvkey(): Promise<Buffer> {
    await this.initialized;
    if (!this.privateKey) {
      throw new Error('Private key not initialized');
    }
    return this.privateKey;
  }

  async getPrvkeyHex(): Promise<string> {
    return bufferUtils.bytesToHex(await this.getPrvkey());
  }

  async sign(digest: Buffer): Promise<[Buffer, number]> {
    const privateKey = await this.getPrvkey();
    const signature = await sign(
      this.curve,
      privateKey,
      digest,
      this.password,
    );
    if (this.curve === 'secp256k1') {
      return [
        signature.slice(0, -1),
        signature[signature.length - 1],
      ];
    }
    return [signature, 0];
  }
}
