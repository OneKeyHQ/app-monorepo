/* eslint-disable max-classes-per-file */

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { N, sign, uncompressPublicKey, verify } from '../secret';
import { decrypt } from '../secret/encryptors/aes256';

import type { ICurveName } from '../types';

export interface IVerifier {
  getPubkey: (compressed?: boolean) => Promise<Buffer>;
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
}

export class Verifier implements IVerifierPro {
  private uncompressedPublicKey: Buffer;

  private compressedPublicKey: Buffer;

  protected curve: ICurveName;

  constructor(pub: string, curve: ICurveName) {
    this.curve = curve;
    this.compressedPublicKey = Buffer.from(pub, 'hex');
    this.uncompressedPublicKey = uncompressPublicKey(
      curve,
      this.compressedPublicKey,
    );
  }

  getPubkey(compressed?: boolean) {
    return Promise.resolve(
      compressed ? this.compressedPublicKey : this.uncompressedPublicKey,
    );
  }

  verify(_digest: Buffer, _signature: Buffer) {
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
    const pub = N(
      curve,
      { key: encryptedPrivateKey, chainCode: Buffer.alloc(32) },
      password,
    ).key.toString('hex');
    super(pub, curve);
  }

  getPrvkey(): Promise<Buffer> {
    return Promise.resolve(decrypt(this.password, this.encryptedPrivateKey));
  }

  sign(digest: Buffer): Promise<[Buffer, number]> {
    const signature = sign(
      this.curve,
      this.encryptedPrivateKey,
      digest,
      this.password,
    );
    if (this.curve === 'secp256k1') {
      return Promise.resolve([
        signature.slice(0, -1),
        signature[signature.length - 1],
      ]);
    }
    return Promise.resolve([signature, 0]);
  }
}
