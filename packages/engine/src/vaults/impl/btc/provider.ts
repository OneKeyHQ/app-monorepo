import * as bitcoin from 'bitcoinjs-lib';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import ECPairFactory from 'ecpair';

import { Provider as BaseProvider } from '../../utils/btcForkChain/provider';
import ecc from '../../utils/btcForkChain/provider/nobleSecp256k1Wrapper';

import type { Network } from '../../utils/btcForkChain/provider/networks';
import type { Signer } from '../../utils/btcForkChain/types';
import type { PsbtInput } from 'bip174/src/lib/interfaces';
import type { Signer as BitcoinSigner } from 'bitcoinjs-lib';
import type { TinySecp256k1Interface } from 'bitcoinjs-lib/src/types';
import type { TinySecp256k1Interface as ECPairTinySecp256k1Interface } from 'ecpair';

bitcoin.initEccLib(ecc as unknown as TinySecp256k1Interface);
const ECPair = ECPairFactory(ecc as unknown as ECPairTinySecp256k1Interface);

function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return bitcoin.crypto.taggedHash(
    'TapTweak',
    Buffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}

export function tweakSigner(
  privKey: Buffer,
  publicKey: Buffer,
  opts: { tweakHash?: Buffer; network?: Network } = {},
): bitcoin.Signer {
  let privateKey: Uint8Array | null = new Uint8Array(privKey.buffer);
  if (!privateKey) {
    throw new Error('Private key is required for tweaking signer!');
  }
  if (publicKey[0] === 3) {
    privateKey = ecc.privateNegate(privateKey);
  }

  if (!privateKey) {
    throw new Error('Private key is required for tweaking signer!');
  }

  const tweakedPrivateKey = ecc.privateAdd(
    privateKey,
    tapTweakHash(toXOnly(publicKey), opts.tweakHash),
  );
  if (!tweakedPrivateKey) {
    throw new Error('Invalid tweaked private key!');
  }

  return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: opts.network,
  });
}

export default class Provider extends BaseProvider {
  override async getBitcoinSigner(
    signer: Signer,
    input: PsbtInput,
  ): Promise<BitcoinSigner> {
    const publicKey = await signer.getPubkey(true);

    // P2TR
    if (input.tapInternalKey) {
      const privateKey = await signer.getPrvkey();
      const tweakedSigner = tweakSigner(privateKey, publicKey, {
        network: this.network,
      });

      return tweakedSigner;
    }

    // For other encoding
    return {
      publicKey,
      // @ts-expect-error
      sign: async (hash: Buffer) => {
        const [sig] = await signer.sign(hash);
        return sig;
      },
    };
  }
}
