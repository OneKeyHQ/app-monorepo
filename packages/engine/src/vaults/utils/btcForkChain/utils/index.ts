import { BIP32Factory } from 'bip32';
import * as BitcoinJS from 'bitcoinjs-lib';
import bs58check from 'bs58check';
import { ECPairFactory } from 'ecpair';
import { cloneDeep } from 'lodash';

import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';

import { NotImplemented } from '../../../../errors';
import { getImplByCoinType } from '../../../../managers/impl';
import { Tx } from '../../../impl/btc/inscribe/sdk';
import { allBtcForkNetworks } from '../provider/networks';
import ecc from '../provider/nobleSecp256k1Wrapper';
import { AddressEncodings } from '../types';

import type { DBUTXOAccount } from '../../../../types/account';
import type { Network } from '../provider/networks';
import type { Networks } from '@cmdcode/tapscript';
import type { BIP32API } from 'bip32/types/bip32';
import type { TinySecp256k1Interface } from 'bitcoinjs-lib/src/types';
import type { ECPairAPI } from 'ecpair/src/ecpair';

export * from './coinSelectUtils';
export * from './tapRootAccountUtils';

type IAccountDefault = {
  namePrefix: string;
  addressEncoding: AddressEncodings;
};

export function getAccountDefaultByPurpose(
  purpose: number,
  impl: string,
): IAccountDefault {
  const coinName = impl ? impl.toUpperCase() : '';
  switch (purpose) {
    case 44:
      return {
        namePrefix: `${coinName} Legacy`,
        addressEncoding: AddressEncodings.P2PKH,
      };
    case 49:
      return {
        namePrefix: `${coinName} Nested SegWit`,
        addressEncoding: AddressEncodings.P2SH_P2WPKH,
      };
    case 84:
      return {
        namePrefix: `${coinName} Native SegWit`,
        addressEncoding: AddressEncodings.P2WPKH,
      };
    case 86:
      return {
        namePrefix: `${coinName} Taproot`,
        addressEncoding: AddressEncodings.P2TR,
      };
    default:
      throw new NotImplemented(`Unsupported purpose ${purpose}.`);
  }
}

export function getBIP44Path(account: DBUTXOAccount, address: string) {
  let realPath = '';
  for (const [key, value] of Object.entries(account.addresses)) {
    if (value === address) {
      realPath = key;
      break;
    }
  }
  return `${account.path}/${realPath}`;
}

export const isTaprootPath = (pathPrefix: string) =>
  pathPrefix.startsWith(`m/86'/`);

export const isTaprootAddress = (address: string) =>
  address.startsWith('bc1p') || address.startsWith('tb1p');

export function isWatchAccountTaprootSegwit(xpubSegwit: string) {
  const reg = /^tr\((.*)\)$/;
  const match = reg.exec(xpubSegwit);
  if (match && match[1]) {
    return true;
  }
  return false;
}

export function isTaprootXpubSegwit(xpubSegwit: string) {
  const reg = /tr\(\[(.*)\](.*)\/<0;1>\/\*\)/;
  const match = reg.exec(xpubSegwit);
  if (match && match[2]) {
    return true;
  }
  return false;
}

export function getTaprootXpub(xpubSegwit: string) {
  const reg = /tr\(\[(.*)\](.*)\/<0;1>\/\*\)/;
  const match = reg.exec(xpubSegwit);
  if (match && match[2]) {
    return match[2];
  }
  return xpubSegwit;
}

// eslint-disable-next-line  @typescript-eslint/no-unused-vars
export function decodeBtcRawTx(rawTx: string, network?: Networks) {
  const tx2 = BitcoinJS.Transaction.fromHex(rawTx);
  const txid = tx2.getId();
  const tx = Tx.decode(rawTx);
  return { tx, txid };
}

let bip32: BIP32API | undefined;
let ECPair: ECPairAPI | undefined;
let isEccInit = false;

export function initBitcoinEcc() {
  if (!isEccInit) {
    BitcoinJS.initEccLib(ecc as unknown as TinySecp256k1Interface);
    isEccInit = true;
  }
}

export function getBitcoinBip32() {
  if (!bip32) {
    initBitcoinEcc();
    // @ts-expect-error
    bip32 = BIP32Factory(ecc);
  }
  return bip32;
}
export function getBitcoinECPair() {
  if (!ECPair) {
    initBitcoinEcc();
    // @ts-expect-error
    ECPair = ECPairFactory(ecc);
  }
  return ECPair;
}

export function getBip32FromBase58({
  coinType,
  key,
}: {
  coinType: string;
  key: string;
}) {
  const impl = getImplByCoinType(coinType);
  if (!impl) {
    throw new Error(`impl not found from coinType: ${coinType}`);
  }
  let network: Network | undefined;
  if (impl === IMPL_BTC) {
    network = allBtcForkNetworks.btc;
  }
  if (impl === IMPL_TBTC) {
    network = allBtcForkNetworks.tbtc;
  }
  if (!network) {
    throw new Error(`network not support: ${impl}`);
  }

  // const accountNameInfoMap = getAccountNameInfoByImpl(IMPL_BTC);
  // const accountNameInfo = Object.values(accountNameInfoMap);

  const buffer = bs58check.decode(key);
  const version = buffer.readUInt32BE(0);

  const versionByteOptions = [
    network.bip32,
    ...Object.values(network.segwitVersionBytes || {}),
  ];
  let bip32Info = cloneDeep(network.bip32);
  for (const versionByte of versionByteOptions) {
    if (versionByte.private === version || versionByte.public === version) {
      bip32Info = cloneDeep(versionByte);
      break;
    }
  }
  const newNetwork = cloneDeep(network);
  newNetwork.bip32 = bip32Info;
  const bip32Api = getBitcoinBip32().fromBase58(key, newNetwork);
  return bip32Api;
}
