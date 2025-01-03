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
  protected uncompressedPublicKey: Buffer;

  protected compressedPublicKey: Buffer;

  protected curve: ICurveName;

  constructor(pub: string, curve: ICurveName) {
    this.curve = curve;
    this.compressedPublicKey = Buffer.from(pub, 'hex');
    this.uncompressedPublicKey = uncompressPublicKey(
      curve,
      this.compressedPublicKey,
    );
  }

  getPubkey(compressed?: boolean): Promise<Buffer> {
    return Promise.resolve(
      compressed ? this.compressedPublicKey : this.uncompressedPublicKey,
    );
  }

  async getPubkeyHex(compressed?: boolean): Promise<string> {
    return bufferUtils.bytesToHex(await this.getPubkey(compressed));
  }

  verify() {
    // verify(_digest: Buffer, _signature: Buffer) {
    // Not used.
    return Promise.resolve(Buffer.from([]));
  }

  verifySignature({
    publicKey,
    digest,
    signature,
  }: {
    publicKey: Buffer | Uint8Array | string; // hex string or Buffer
    digest: Buffer | Uint8Array | string; // hex string or Buffer
    signature: Buffer | Uint8Array | string; // hex string or Buffer
  }): Promise<boolean> {
    const p = bufferUtils.toBuffer(publicKey);
    const d = bufferUtils.toBuffer(digest);
    const s = bufferUtils.toBuffer(signature);
    const { curve } = this;
    const result = verify(curve, p, d, s);
    return Promise.resolve(result);
  }
}

export class ChainSigner extends Verifier implements ISigner {
  constructor(
    private encryptedPrivateKey: Buffer,
    private password: string,
    protected override curve: ICurveName,
  ) {
    // Initialize with empty public key, will be set in init()
    super('', curve);
    void this.init();
  }

  private async init() {
    const result = await N(
      this.curve,
      { key: this.encryptedPrivateKey, chainCode: Buffer.alloc(32) },
      this.password,
    );
    const pub = result.key.toString('hex');
    this.compressedPublicKey = Buffer.from(pub, 'hex');
    this.uncompressedPublicKey = uncompressPublicKey(
      this.curve,
      this.compressedPublicKey,
    );
  }

  async getPrvkey(): Promise<Buffer> {
    return decryptAsync({
      password: this.password,
      data: this.encryptedPrivateKey,
    });
  }

  async getPrvkeyHex(): Promise<string> {
    return bufferUtils.bytesToHex(await this.getPrvkey());
  }

  async sign(digest: Buffer): Promise<[Buffer, number]> {
    const signature = await sign(
      this.curve,
      this.encryptedPrivateKey,
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
