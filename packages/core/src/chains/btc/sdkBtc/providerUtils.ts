import { IServerNetwork } from '@onekeyhq/shared/types';
import * as BitcoinJS from 'bitcoinjs-lib';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { scriptPkToAddress } from '.';

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

export function decodedPsbt({psbt, psbtNetwork}:{
  psbt: Psbt;
  psbtNetwork: BitcoinJS.networks.Network;
}) {
  const inputs = psbt.txInputs.map((input, index) => {
    const txid = Buffer.from(input.hash).reverse().toString('hex');
    let value: number | undefined = 0;
    let script: Buffer | undefined;
    const v = psbt.data.inputs[index]
    if (v.witnessUtxo) {
      script = v.witnessUtxo?.script;
      value = v.witnessUtxo?.value;
    } else if (v.nonWitnessUtxo) {
      const tx = Transaction.fromBuffer(v.nonWitnessUtxo);
      const output = tx.outs[input.index];
      script = output.script;
      value = output.value;
    }

    let address = '';
    if (script) {
      address = scriptPkToAddress(script, psbtNetwork);
    }

    return {
      txid,
      vout: input.index,
      value,
      address
    };
  });

  const outputs = psbt.txOutputs.map(output => {
    let address = '';
    try {
      address = scriptPkToAddress(output.script, psbtNetwork);
    } catch (err) {
    }

    return {
      address,
      value: output.value,
    };
  });

  const inputValue = inputs.reduce((sum, input) => sum + input.value, 0);
  const outputValue = outputs.reduce((sum, output) => sum + output.value, 0);
  const fee = inputValue - outputValue;

  const result = {
    inputInfos: inputs,
    outputInfos: outputs,
    fee,
  };

  return result
}
