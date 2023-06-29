/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { InvalidAddressError } from 'bchaddrjs';
import bs58check from 'bs58check';
import { decode, encode } from 'nexaaddrjs';

import { hash160 } from '../../../secret/hash';

import { Opcode, bufferToScripChunk, scriptChunksToBuffer } from './sdk';

import type { Verifier } from '../../../proxy';

export function verifyNexaAddress(address: string) {
  try {
    decode(address);
    return {
      isValid: true,
      normalizedAddress: address,
    };
  } catch (error) {
    return {
      isValid: false,
    };
  }
}

const NETWORKS = {
  mainnet: {
    name: 'livenet',
    alias: 'mainnet',
    prefix: 'nexa',
    pubkeyhash: 0x19,
    privatekey: 0x23,
    scripthash: 0x44,
    xpubkey: 0x42696720,
    xprivkey: 0x426c6b73,
    networkMagic: 0x72271221,
  },
  testnet: {
    name: 'nexatest',
    prefix: 'nexatest',
    pubkeyhash: 0x6f,
    privatekey: 0xef,
    scripthash: 0xc4,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    networkMagic: 0xf4e5f3f4,
  },
};

function getNetworkInfo(chanid: string): {
  name: string;
  prefix: string;
  pubkeyhash: number;
  privatekey: number;
  scripthash: number;
  xpubkey: number;
  xprivkey: number;
  networkMagic: number;
} {
  return chanid === 'testnet' ? NETWORKS.testnet : NETWORKS.mainnet;
}

enum NexaAddressType {
  PayToPublicKeyHash = 'P2PKH',
  PayToScriptHash = 'SCRIPT',
  PayToScriptTemplate = 'TEMPLATE',
  GroupedPayToPublicKeyTemplate = 'GROUP',
}

export function publickeyToAddress(
  publicKey: Buffer,
  chainId: string,
  type: NexaAddressType = NexaAddressType.PayToScriptTemplate,
): string {
  const network = getNetworkInfo(chainId);
  let hashBuffer: Buffer;
  if (type === NexaAddressType.PayToPublicKeyHash) {
    hashBuffer = hash160(publicKey);
  } else if (type === NexaAddressType.PayToScriptTemplate) {
    const templateChunk = bufferToScripChunk(publicKey);
    const scriptBuffer = scriptChunksToBuffer([templateChunk]);
    const constraintHash = hash160(scriptBuffer);
    const chunks = [
      { opcodenum: Opcode.OP_FALSE },
      { opcodenum: Opcode.OP_1 },
      bufferToScripChunk(constraintHash),
    ];
    hashBuffer = scriptChunksToBuffer([
      bufferToScripChunk(scriptChunksToBuffer(chunks)),
    ]);
  }
  return encode(network.prefix, type, hashBuffer);
}
