import * as BitcoinJS from 'bitcoinjs-lib';
import uuid from 'react-native-uuid';

import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import {
  NFTAssetType,
  type NFTBTCAssetModel,
} from '@onekeyhq/engine/src/types/nft';
import type { IDecodedTxAction } from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';

import { isBTCNetwork } from '../../engine/engineConsts';

import { NETWORK_TYPES, NetworkTypeEnum } from './ProviderApiBtc.types';

import type { InputToSign, Inscription } from './ProviderApiBtc.types';

export const OPENAPI_URL_MAINNET = 'https://wallet-api.unisat.io/v5';
export const OPENAPI_URL_TESTNET = 'https://wallet-api-testnet.unisat.io/v5';

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
  if (network && isBTCNetwork(network.id)) {
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
    data: T;
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
    type: NFTAssetType.BTC,
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
        if (account.template?.startsWith(`m/86'/`) && !v.tapInternalKey) {
          v.tapInternalKey = toXOnly(
            Buffer.from(account.pubKey as string, 'hex'),
          );
        }
      }
    }
  });
  return inputsToSign;
}

function checkInscriptionInfo(action: IDecodedTxAction, address: string) {
  return (
    action.type === IDecodedTxActionType.NFT_TRANSFER_BTC &&
    (action.inscriptionInfo?.send && action.inscriptionInfo?.send !== 'unknown'
      ? action.inscriptionInfo?.send === address
      : true) &&
    (action.inscriptionInfo?.receive &&
    action.inscriptionInfo?.receive !== 'unknown'
      ? action.inscriptionInfo?.receive === address
      : true)
  );
}

function checkBRC20Info(action: IDecodedTxAction, address: string) {
  return (
    action.type === IDecodedTxActionType.TOKEN_BRC20_TRANSFER &&
    (action.brc20Info?.sender && action.brc20Info.sender !== 'unknown'
      ? action.brc20Info?.sender === address
      : true) &&
    (action.brc20Info?.receiver && action.brc20Info?.receiver !== 'unknown'
      ? action.brc20Info?.receiver === address
      : true)
  );
}

export function checkIsUnListOrderPsbt(
  actions: IDecodedTxAction[] | undefined,
  address: string | undefined,
) {
  if (!actions || !address) return false;

  if (actions?.length === 1) {
    return (
      checkBRC20Info(actions[0], address) ||
      checkInscriptionInfo(actions[0], address)
    );
  }

  if (actions?.length >= 2) {
    return (
      (checkBRC20Info(actions[0], address) &&
        checkBRC20Info(actions[1], address)) ||
      (checkInscriptionInfo(actions[0], address) &&
        checkInscriptionInfo(actions[1], address))
    );
  }

  return false;
}
