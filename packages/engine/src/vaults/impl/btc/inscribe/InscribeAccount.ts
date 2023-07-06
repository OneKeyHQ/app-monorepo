import { Script, Tap } from '@cmdcode/tapscript';
import { schnorr as secp256k1SchnorrSdk } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

import { tapRootAccountUtils } from '../../../utils/btcForkChain/utils';

import { Signer } from './sdk';

import type { ITaprootAddressInfoInscription, TxTemplate } from './types';
import type { Bytes, Networks, ScriptData } from '@cmdcode/tapscript';

// TODO rename to InscribeAgentAccount
//      AgentL1Address, AgentL2Address
export class InscribeAccount {
  constructor({
    privateKey,
    network,
  }: {
    privateKey: string;
    network: Networks;
  }) {
    if (!['main', 'testnet', 'signet', 'regtest'].includes(network)) {
      throw new Error('InscribeAccount ERROR: network is not valid');
    }
    if (privateKey?.length !== 64) {
      throw new Error('InscribeAccount ERROR: privateKey is not valid');
    }

    // secp256k1SchnorrSdk.utils.randomPrivateKey();
    this.network = network;
    this.privateKeyString = privateKey; //  64 length
    // TODO check privateKeyBytes if 32 bytes
    this.privateKeyBytes = hexToBytes(this.privateKeyString); // 32 length
    this.publicKeyBytes = secp256k1SchnorrSdk.getPublicKey(
      this.privateKeyBytes,
    ); // 32 length

    // const SecretKey = require('@cmdcode/crypto-utils').SecretKey;
    // const keyPair = new SecretKey(privateKeyString, {
    //   type: 'taproot',
    // });
    // const publicKeyBytes = keyPair.pub.raw; // keyPair.pub.rawX;
  }

  network: Networks = 'regtest';

  privateKeyString = '';

  privateKeyBytes: Bytes = '';

  publicKeyBytes: Bytes = '';

  checkKeyIsValid() {
    if (!this.publicKeyBytes) {
      throw new Error('InscribeAccount ERROR: publicKey is undefined');
    }
    if (!this.privateKeyBytes) {
      throw new Error('InscribeAccount ERROR: privateKey is undefined');
    }
  }

  createAddressInfo({
    script,
  }: {
    script: ScriptData;
  }): ITaprootAddressInfoInscription {
    this.checkKeyIsValid();
    // bitcoin.payments.p2tr()
    const leaf = Tap.tree.getLeaf(Script.encode(script));
    const publicKey = this.publicKeyBytes;

    //  const init_cblock = await BTON.Tap.getPath(pubkey, init_leaf);
    const [, cBlock] = Tap.getPubKey(publicKey, {
      tapleaf: leaf,
      tree: [leaf],
    });
    const tapKey = bytesToHex(
      // TODO why should slice(1)
      Tap.tweak.getPubKey(publicKey, leaf).slice(1, 33),
    );

    const { address, scriptPubKey } = tapRootAccountUtils.parseTapKey({
      tapKey,
      network: this.network,
    });

    // const address1 = Address.p2tr.fromPubKey(publicKey, this.network);
    // const address2 = Address.p2tr.scriptPubKey(Script.encode(script));

    return {
      address,
      tapKey,
      cBlock,
      leaf,
      scriptPubKey,
    };
  }

  signTransaction({
    txToSign,
    leaf,
    random,
  }: {
    txToSign: TxTemplate;
    leaf: string;
    random?: Bytes;
  }) {
    this.checkKeyIsValid();
    const signature = Signer.taproot.sign(this.privateKeyBytes, txToSign, 0, {
      extension: leaf,
      // @ts-ignore
      rand: random,
    });
    return signature;
  }

  verifySignature({
    signedTx,
    leaf,
    random,
  }: {
    signedTx: TxTemplate;
    leaf: string;
    random?: Bytes;
  }) {
    const result = Signer.taproot.verify(signedTx, 0, {
      extension: leaf,
      // @ts-ignore
      rand: random,
      throws: true,
    });
    return result;
  }

  signTransaction2({
    txToSign,
    leaf,
    random,
  }: {
    txToSign: TxTemplate;
    leaf: string;
    random?: Bytes;
  }) {
    this.checkKeyIsValid();
    // https://github.com/cmdruid/tapscript/blob/master/src/lib/sig/taproot/sign.ts#L12
    const txHash = Signer.taproot.hash(txToSign, 0, {
      extension: leaf,
    });
    // account.keyPair.sign()
    const signature = secp256k1SchnorrSdk.sign(
      txHash,
      this.privateKeyBytes,
      random,
    );
    return signature;
  }
}
