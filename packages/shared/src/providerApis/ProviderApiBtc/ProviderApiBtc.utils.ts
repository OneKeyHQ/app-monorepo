import * as BitcoinJS from 'bitcoinjs-lib';
import uuid from 'react-native-uuid';

import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';

import { IMPL_BTC, IMPL_TBTC } from '../../engine/engineConsts';

import { NETWORK_TYPES, NetworkTypeEnum } from './ProviderApiBtc.types';

import type { InputToSign, Inscription } from './ProviderApiBtc.types';

export const OPENAPI_URL_MAINNET = 'https://unisat.io/wallet-api-v4';
export const OPENAPI_URL_TESTNET = 'https://unisat.io/testnet/wallet-api-v4';

export function toXOnly(pubKey: Buffer) {
  return pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);
}

export function toPsbtNetwork(network: Network) {
  if (network.isTestnet) {
    return BitcoinJS.networks.testnet;
  }
  return BitcoinJS.networks.bitcoin;
}

export function getNetworkName(network: Network) {
  if (network && (network.impl === IMPL_BTC || network.impl === IMPL_TBTC)) {
    if (network.isTestnet) {
      return Promise.resolve(NETWORK_TYPES[NetworkTypeEnum.TESTNET].name);
    }
    return Promise.resolve(NETWORK_TYPES[NetworkTypeEnum.MAINNET].name);
  }
}

export function formatPsbtHex(psbtHex: string) {
  let formatData = '';
  try {
    if (!/^[0-9a-fA-F]+$/.test(psbtHex)) {
      formatData = BitcoinJS.Psbt.fromBase64(psbtHex).toHex();
    } else {
      BitcoinJS.Psbt.fromHex(psbtHex);
      formatData = psbtHex;
    }
  } catch (e) {
    throw new Error('invalid psbt');
  }
  return formatData;
}

export async function httpPost<T>({
  isTestnet,
  route,
  params,
}: {
  isTestnet: boolean;
  route: string;
  params: any;
}) {
  const url = isTestnet ? OPENAPI_URL_TESTNET : OPENAPI_URL_MAINNET + route;
  const headers = new Headers();
  headers.append('X-Client', 'UniSat Wallet');
  headers.append('X-Version', '1.0.0');
  headers.append('x-channel', 'store');
  headers.append('x-udid', uuid.v4().toString());
  headers.append('Content-Type', 'application/json;charset=utf-8');
  const res = await fetch(new Request(url), {
    method: 'POST',
    headers,
    mode: 'cors',
    cache: 'default',
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    status: string;
    message: string;
    result: T;
  };

  if (data.status === '0') {
    throw new Error(data.message);
  }
  return data;
}

export function mapInscriptionToNFTBTCAssetModel(inscription: Inscription) {
  const asset = {
    inscription_id: inscription.inscriptionId,
    inscription_number: inscription.inscriptionNumber,
    tx_hash: '',
    content: '',
    content_length: inscription.contentLength,
    content_type: inscription.contentType,
    timestamp: inscription.timestamp.toString(),
    output: inscription.output,
    owner: inscription.address,
    output_value_sat: inscription.outputValue,
    genesis_transaction_hash: inscription.genesisTransaction,
    location: inscription.location,
    contentUrl: inscription.content,
  } as NFTBTCAssetModel;
  return asset;
}

export function getInputsToSignFromPsbt({
  psbt,
  psbtNetwork,
  account,
}: {
  account: Account;
  psbt: BitcoinJS.Psbt;
  psbtNetwork: BitcoinJS.networks.Network;
}) {
  const inputsToSign: InputToSign[] = [];
  psbt.data.inputs.forEach((v, index) => {
    let script: any = null;
    let value = 0;
    if (v.witnessUtxo) {
      script = v.witnessUtxo.script;
      value = v.witnessUtxo.value;
    } else if (v.nonWitnessUtxo) {
      const tx = BitcoinJS.Transaction.fromBuffer(v.nonWitnessUtxo);
      const output = tx.outs[psbt.txInputs[index].index];
      script = output.script;
      value = output.value;
    }
    const isSigned = v.finalScriptSig || v.finalScriptWitness;

    if (script && !isSigned) {
      const address = BitcoinJS.address.fromOutputScript(script, psbtNetwork);
      if (account.address === address) {
        inputsToSign.push({
          index,
          publicKey: account.pubKey as string,
          address,
          sighashTypes: v.sighashType ? [v.sighashType] : undefined,
        });
        if (
          (account.template as string).startsWith(`m/86'/`) &&
          !v.tapInternalKey
        ) {
          v.tapInternalKey = toXOnly(
            Buffer.from(account.pubKey as string, 'hex'),
          );
        }
      }
    }
  });
  return inputsToSign;
}
