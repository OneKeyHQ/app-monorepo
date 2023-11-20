// eslint-disable-next-line max-classes-per-file
import BigNumber from 'bignumber.js';
import elliptic from 'elliptic';

import { parse256 } from '../bip32';

import type { IBaseCurve, ICurveForKD } from './base';

type IEllipticBasePoint = elliptic.curve.base.BasePoint;

class EllipticECWrapper implements ICurveForKD {
  groupOrder: BigNumber;

  constructor(private curve: elliptic.ec) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.groupOrder = new BigNumber(curve.n!.toString());
  }

  transformPublicKey(publicKey: Buffer): Buffer {
    let toCompressed: boolean;
    // eslint-disable-next-line eqeqeq
    if (publicKey.length == 33 && (publicKey[0] === 2 || publicKey[0] === 3)) {
      toCompressed = false;
      // eslint-disable-next-line eqeqeq
    } else if (publicKey.length == 65 && publicKey[0] === 4) {
      toCompressed = true;
    } else {
      throw new Error('Invalid public key.');
    }

    return Buffer.from(
      this.curve
        .keyFromPublic(publicKey)
        .getPublic()
        .encode(undefined, toCompressed),
    );
  }

  publicFromPrivate(privateKey: Buffer): Buffer {
    return Buffer.from(
      this.curve.keyFromPrivate(privateKey).getPublic().encodeCompressed(),
    );
  }

  verify(publicKey: Buffer, digest: Buffer, signature: Buffer): boolean {
    // eslint-disable-next-line eqeqeq
    if (signature.length != 65) {
      return false;
    }
    return this.curve.keyFromPublic(publicKey).verify(digest, {
      r: signature.slice(0, 32),
      s: signature.slice(32, 64),
      recoveryParam: parseInt(signature[64].toString()),
    });
  }

  sign(privateKey: Buffer, digest: Buffer): Buffer {
    const signature: elliptic.ec.Signature = this.curve
      .keyFromPrivate(privateKey)
      .sign(digest, { canonical: true });
    return Buffer.concat([
      signature.r.toArrayLike(Buffer, 'be', 32),
      signature.s.toArrayLike(Buffer, 'be', 32),
      // @ts-expect-error
      Buffer.from([signature.recoveryParam]),
    ]);
  }

  getChildPublicKey(IL: Buffer, parentPublicKey: Buffer): Buffer | null {
    if (parse256(IL).gte(this.groupOrder)) {
      return null;
    }
    const p: IEllipticBasePoint = this.curve.keyFromPrivate(IL).getPublic();
    const q: IEllipticBasePoint = this.curve
      .keyFromPublic(parentPublicKey)
      .getPublic();
    const r: IEllipticBasePoint = p.add(q);
    if (r.isInfinity()) {
      return null;
    }
    return Buffer.from(r.encodeCompressed());
  }
}

class EllipticEDDSAWrapper implements IBaseCurve {
  // eslint-disable-next-line no-useless-constructor
  constructor(private curve: elliptic.eddsa) {
    // noop
  }

  transformPublicKey(publicKey: Buffer): Buffer {
    return publicKey;
  }

  publicFromPrivate(privateKey: Buffer): Buffer {
    return Buffer.from(this.curve.keyFromSecret(privateKey).getPublic());
  }

  verify(publicKey: Buffer, digest: Buffer, signature: Buffer): boolean {
    return this.curve
      .keyFromPublic(publicKey.toString('hex'))
      .verify(digest, signature.toString('hex'));
  }

  sign(privateKey: Buffer, digest: Buffer): Buffer {
    return Buffer.from(
      this.curve.keyFromSecret(privateKey).sign(digest).toBytes(),
    );
  }
}

const secp256k1: ICurveForKD = new EllipticECWrapper(
  // eslint-disable-next-line new-cap
  new elliptic.ec('secp256k1'),
);
// eslint-disable-next-line new-cap
const nistp256: ICurveForKD = new EllipticECWrapper(new elliptic.ec('p256'));
const ed25519: IBaseCurve = new EllipticEDDSAWrapper(
  // eslint-disable-next-line new-cap
  new elliptic.eddsa('ed25519'),
);

export { ed25519, nistp256, secp256k1 };
