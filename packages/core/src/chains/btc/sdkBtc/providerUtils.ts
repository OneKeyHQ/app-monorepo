import {
  getBtcForkNetwork,
  loadOPReturn,
  pubkeyToPayment,
  scriptPkToAddress,
} from '.';

import BigNumber from 'bignumber.js';
import * as BitcoinJS from 'bitcoinjs-lib';
import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { EAddressEncodings, ICoreApiSignTxPayload } from '../../../types';

import type { ICoreApiSignBtcExtraInfo, IUnsignedTxPro } from '../../../types';
import type {
  IBtcForkNetwork,
  IBtcForkTransactionMixin,
  IEncodedTxBtc,
} from '../types';

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

export function toPsbtNetwork(
  network: IServerNetwork,
): BitcoinJS.networks.Network {
  return getBtcForkNetwork(network.code);
}

export function decodedPsbt({
  psbt,
  psbtNetwork,
}: {
  psbt: Psbt;
  psbtNetwork: BitcoinJS.networks.Network;
}) {
  const inputs = psbt.txInputs.map((input, index) => {
    const txid = Buffer.from(input.hash).reverse().toString('hex');
    let value: number | undefined = 0;
    let script: Buffer | undefined;
    const v = psbt.data.inputs[index];
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
      address,
    };
  });

  const outputs = psbt.txOutputs.map((output) => {
    let address = '';
    try {
      address = scriptPkToAddress(output.script, psbtNetwork);
    } catch (err) {
      //
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

  return result;
}

export function newPsbt({ network }: { network: IBtcForkNetwork }): Psbt {
  return new Psbt({ network });
}

export async function buildPsbt({
  network,
  unsignedTx,
  btcExtraInfo,
  getPubKey,
}: {
  unsignedTx: IUnsignedTxPro;
  btcExtraInfo: ICoreApiSignBtcExtraInfo | undefined;
  network: IBtcForkNetwork;
  getPubKey: (params: { address: string }) => Promise<Buffer>;
}) {
  const { inputs, outputs } = unsignedTx.encodedTx as IEncodedTxBtc;

  const inputAddressesEncodings = checkIsDefined(
    btcExtraInfo?.inputAddressesEncodings,
  );
  const nonWitnessPrevTxs = checkIsDefined(btcExtraInfo?.nonWitnessPrevTxs);

  const psbt = newPsbt({ network });

  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i];

    const inputValue: number = new BigNumber(input.value).toNumber();
    const encoding = inputAddressesEncodings[i];
    const mixin: IBtcForkTransactionMixin = {};

    const pubkey = await getPubKey({ address: input.address });

    switch (encoding) {
      case EAddressEncodings.P2PKH:
        mixin.nonWitnessUtxo = Buffer.from(
          nonWitnessPrevTxs[input.txid],
          'hex',
        );
        break;
      case EAddressEncodings.P2WPKH:
        mixin.witnessUtxo = {
          script: checkIsDefined(
            pubkeyToPayment({
              pubkey,
              encoding,
              network,
            }),
          ).output as Buffer,
          value: inputValue,
        };
        break;
      case EAddressEncodings.P2SH_P2WPKH:
        {
          const payment = checkIsDefined(
            pubkeyToPayment({
              pubkey,
              encoding,
              network,
            }),
          );
          mixin.witnessUtxo = {
            script: payment.output as Buffer,
            value: inputValue,
          };
          mixin.redeemScript = payment.redeem?.output as Buffer;
        }
        break;
      case EAddressEncodings.P2TR:
        {
          const payment = checkIsDefined(
            pubkeyToPayment({
              pubkey,
              encoding,
              network,
            }),
          );
          mixin.witnessUtxo = {
            script: payment.output as Buffer,
            value: inputValue,
          };
          mixin.tapInternalKey = payment.internalPubkey;
        }
        break;
      default:
        break;
    }

    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      ...mixin,
    });
  }

  outputs.forEach((output) => {
    const { payload } = output;
    if (
      payload?.opReturn &&
      typeof payload?.opReturn === 'string' &&
      payload?.opReturn.length > 0
    ) {
      const embed = payments.embed({
        data: [loadOPReturn(payload?.opReturn)],
      });
      psbt.addOutput({
        script: checkIsDefined(embed.output),
        value: 0,
      });
    } else {
      const outputValue: number = new BigNumber(output.value).toNumber();
      psbt.addOutput({
        address: output.address,
        value: outputValue,
      });
    }
  });

  return psbt;
}
