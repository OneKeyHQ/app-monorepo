/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { InvalidAddressError } from 'bchaddrjs';
import bs58check from 'bs58check';
import { encode } from 'nexaaddrjs';

import type { Verifier } from '../../../proxy';

export async function pubkeyToAddress(verifier: Verifier, chainId: string) {
  const uncompressPubKey = await verifier.getPubkey(false);
  const pubkey = uncompressPubKey.slice(1);
  const unit8Array = new Uint8Array(33);
  unit8Array.set(new Uint8Array([32]), 0);
  unit8Array.set(new Uint8Array(pubkey.slice(0, 32)), 1);

  const address: string = encode(
    chainId === 'testnet' ? 'nexatest' : 'nexa',
    'TEMPLATE',
    unit8Array,
  );
  console.log(address);
  return address;
  // const ethAddress = ethAddressToCfxAddress(keccak256(pubkey).slice(-40));
  // const networkID = parseInt(chainId);
  // return toCfxAddress(ethAddress, networkID);
}

const BASE_58_CHECK_PAYLOAD_LENGTH = 21;
const Format: Record<string, string> = {};
Format.Legacy = 'legacy';
Format.Bitpay = 'bitpay';
Format.Cashaddr = 'cashaddr';
const Network: Record<string, string> = {};
Network.Mainnet = 'mainnet';
Network.Testnet = 'testnet';
const Type: Record<string, string> = {};
Type.P2PKH = 'p2pkh';
Type.P2SH = 'p2sh';

const VERSION_BYTE: any = {};
VERSION_BYTE[Format.Legacy] = {};
VERSION_BYTE[Format.Legacy][Network.Mainnet] = {};
VERSION_BYTE[Format.Legacy][Network.Mainnet][Type.P2PKH] = 0;
VERSION_BYTE[Format.Legacy][Network.Mainnet][Type.P2SH] = 5;
VERSION_BYTE[Format.Legacy][Network.Testnet] = {};
VERSION_BYTE[Format.Legacy][Network.Testnet][Type.P2PKH] = 111;
VERSION_BYTE[Format.Legacy][Network.Testnet][Type.P2SH] = 196;
VERSION_BYTE[Format.Bitpay] = {};
VERSION_BYTE[Format.Bitpay][Network.Mainnet] = {};
VERSION_BYTE[Format.Bitpay][Network.Mainnet][Type.P2PKH] = 28;
VERSION_BYTE[Format.Bitpay][Network.Mainnet][Type.P2SH] = 40;
VERSION_BYTE[Format.Bitpay][Network.Testnet] = {};
VERSION_BYTE[Format.Bitpay][Network.Testnet][Type.P2PKH] = 111;
VERSION_BYTE[Format.Bitpay][Network.Testnet][Type.P2SH] = 196;

export function decodeBase58Address(address: string) {
  try {
    const payload = bs58check.decode(address);
    if (payload.length !== BASE_58_CHECK_PAYLOAD_LENGTH) {
      throw new InvalidAddressError();
    }
    const versionByte = payload[0];
    const hash = Array.prototype.slice.call(payload, 1);
    switch (versionByte) {
      case VERSION_BYTE[Format.Legacy][Network.Mainnet][Type.P2PKH]:
        return {
          hash,
          format: Format.Legacy,
          network: Network.Mainnet,
          type: Type.P2PKH,
        };
      case VERSION_BYTE[Format.Legacy][Network.Mainnet][Type.P2SH]:
        return {
          hash,
          format: Format.Legacy,
          network: Network.Mainnet,
          type: Type.P2SH,
        };
      case VERSION_BYTE[Format.Legacy][Network.Testnet][Type.P2PKH]:
        return {
          hash,
          format: Format.Legacy,
          network: Network.Testnet,
          type: Type.P2PKH,
        };
      case VERSION_BYTE[Format.Legacy][Network.Testnet][Type.P2SH]:
        return {
          hash,
          format: Format.Legacy,
          network: Network.Testnet,
          type: Type.P2SH,
        };
      case VERSION_BYTE[Format.Bitpay][Network.Mainnet][Type.P2PKH]:
        return {
          hash,
          format: Format.Bitpay,
          network: Network.Mainnet,
          type: Type.P2PKH,
        };
      case VERSION_BYTE[Format.Bitpay][Network.Mainnet][Type.P2SH]:
        return {
          hash,
          format: Format.Bitpay,
          network: Network.Mainnet,
          type: Type.P2SH,
        };
      default: {
        return {};
      }
    }
  } catch (error) {
    console.error(error);
  }
  throw new InvalidAddressError();
}
