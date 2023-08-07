import elliptic from 'elliptic';

// eslint-disable-next-line new-cap
const ec = new elliptic.ec('secp256k1');

class HashKeySigner {
  sk: elliptic.ec.KeyPair;

  keyHex: string;

  constructor(keyHex: string) {
    this.keyHex = keyHex;
    if (!keyHex) {
      throw new Error('Invalid key');
    }
    this.sk = ec.keyFromPrivate(Buffer.from(keyHex, 'hex'));
  }

  get pk() {
    return this.sk.getPublic();
  }

  get pkHex() {
    return this.pk.encodeCompressed('hex');
  }

  sign(message: string | Uint8Array) {
    if (!message) {
      throw new Error('Invalid message');
    }
    return this.sk.sign(message, { canonical: true });
  }

  verify(message: string, signature: string) {
    try {
      return this.sk.verify(message, signature);
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}

export default HashKeySigner;
