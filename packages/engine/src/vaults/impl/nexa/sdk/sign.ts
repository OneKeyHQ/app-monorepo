import BN from 'bn.js';
import elliptic from 'elliptic';

import { hmacSHA256, sha256 } from '../../../../secret/hash';

import { getBufferFromBN } from './bn';

import type { curve } from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

export function reverseBuffer(buffer: Buffer | string): Buffer {
  const buf = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer;
  const { length } = buf;
  const reversed = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    reversed[i] = buf[length - i - 1];
  }
  return reversed;
}

function getBN(buffer: Buffer, isLittleEndian = false) {
  const buf = isLittleEndian ? reverseBuffer(buffer) : buffer;
  const hex = buf.toString('hex');
  return new BN(hex, 16);
}

function nonceFunctionRFC6979(privkey: Buffer, msgbuf: Buffer): BN {
  let V = Buffer.from(
    '0101010101010101010101010101010101010101010101010101010101010101',
    'hex',
  );
  let K = Buffer.from(
    '0000000000000000000000000000000000000000000000000000000000000000',
    'hex',
  );

  const blob = Buffer.concat([
    privkey,
    msgbuf,
    Buffer.from('', 'ascii'),
    Buffer.from('Schnorr+SHA256  ', 'ascii'),
  ]);

  K = hmacSHA256(K, Buffer.concat([V, Buffer.from('00', 'hex'), blob]));
  V = hmacSHA256(K, V);

  K = hmacSHA256(K, Buffer.concat([V, Buffer.from('01', 'hex'), blob]));
  V = hmacSHA256(K, V);

  let k = new BN(0);
  let T;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const N = new BN(ec.curve.n.toArray());
  // eslint-disable-next-line no-constant-condition
  while (true) {
    V = hmacSHA256(K, V);
    T = getBN(V);

    k = T;
    if (k.gt(new BN(0)) && k.lt(N)) {
      break;
    }
    K = hmacSHA256(K, Buffer.concat([V, Buffer.from('00', 'hex')]));
    V = hmacSHA256(K, V);
  }
  return k;
}

function isSquare(x: BN): boolean {
  const p = new BN(
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F',
    'hex',
  );
  const x0 = new BN(x);
  const base = x0.toRed(BN.red(p));
  const res = base.redPow(p.sub(new BN(1)).div(new BN(2))).fromRed(); // refactor to BN arithmetic operations
  return res.eq(new BN(1));
}

function hasSquare(point: curve.base.BasePoint): boolean {
  return !point.isInfinity() && isSquare(new BN(point.getY().toArray()));
}

function getrBuffer(r: BN): Buffer {
  const rNaturalLength = getBufferFromBN(r).length;
  if (rNaturalLength < 32) {
    return getBufferFromBN(r, 'be', 32);
  }
  return getBufferFromBN(r);
}

function pointToCompressed(point: curve.base.BasePoint): Buffer {
  const xbuf = getBufferFromBN(point.getX(), 'be', 32);
  const ybuf = getBufferFromBN(point.getY(), 'be', 32);

  let prefix;
  const odd = ybuf[ybuf.length - 1] % 2;
  if (odd) {
    prefix = Buffer.from([0x03]);
  } else {
    prefix = Buffer.from([0x02]);
  }
  return Buffer.concat([prefix, xbuf]);
}

function findSignature(d: BN, e: BN) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-member-access
  const G: curve.base.BasePoint = ec.curve.g as curve.base.BasePoint;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const n: BN = new BN(ec.curve.n.toArray());
  let k = nonceFunctionRFC6979(
    getBufferFromBN(d, 'be', 32),
    getBufferFromBN(e, 'be', 32),
  );
  const P = G.mul(d as any);
  const R = G.mul(k as any);

  if (!hasSquare(R)) {
    k = n.sub(k);
  }

  const r = R.getX();
  const e0 = getBN(
    sha256(
      Buffer.concat([
        getrBuffer(r),
        pointToCompressed(P),
        getBufferFromBN(e, 'be', 32),
      ]),
    ),
  );

  const s = e0.mul(d).add(k).mod(n);
  return {
    r,
    s,
  };
}

export function sign(privateKey: Buffer, digest: Buffer): Buffer {
  const privateKeyBN = getBN(privateKey);
  const digestBN = getBN(digest);
  const { r, s } = findSignature(privateKeyBN, digestBN);
  return Buffer.concat([
    getBufferFromBN(r, 'be', 32),
    getBufferFromBN(s, 'be', 32),
  ]);
}

export function verify(
  publicKey: Buffer,
  digest: Buffer,
  signature: Buffer,
): boolean {
  if (signature.length !== 64) {
    return false;
  }
  const r = getBN(signature.slice(0, 32));
  const s = getBN(signature.slice(32));

  const hashbuf = digest;

  const xbuf = publicKey.slice(1);
  const x = getBN(xbuf);
  // publicKey[0] === 0x02
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  let P: curve.base.BasePoint = ec.curve.pointFromX(x, false);

  if (publicKey[0] === 0x03) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    P = ec.curve.pointFromX(x, true);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const G: curve.base.BasePoint = ec.curve.g as curve.base.BasePoint;
  if (P.isInfinity()) {
    return true;
  }
  const p = new BN(
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F',
    'hex',
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const n = new BN(ec.curve.n.toArray());
  if (r.gte(p) || s.gte(n)) {
    // ("Failed >= condition")
    return false;
  }
  const Br = getrBuffer(r);
  const Bp = pointToCompressed(P);
  const hash = sha256(Buffer.concat([Br, Bp, hashbuf]));

  // const e = BN.fromBuffer(hash, 'big').umod(n);
  const e = new BN(hash, 'be').umod(n);
  const sG = G.mul(s as any);
  const eP = P.mul(n.sub(e as any) as any);
  const R = sG.add(eP);

  if (R.isInfinity() || !hasSquare(R) || !R.getX().eq(r as any)) {
    return false;
  }

  return true;
}
