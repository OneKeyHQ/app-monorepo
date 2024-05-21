import { IServerNetwork } from '@onekeyhq/shared/types';
import * as BitcoinJS from 'bitcoinjs-lib';

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

export function toPsbtNetwork(network: IServerNetwork) {
  if (network.isTestnet) {
    return BitcoinJS.networks.testnet;
  }
  return BitcoinJS.networks.bitcoin;
}
