import {
  getBtcForkNetwork,
  isTaprootAddress,
  loadOPReturn,
  pubkeyToPayment,
  scriptPkToAddress,
} from '.';

import BigNumber from 'bignumber.js';
import * as BitcoinJS from 'bitcoinjs-lib';
import { Psbt, Transaction, payments } from 'bitcoinjs-lib';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import { isEmpty } from 'lodash';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { EAddressEncodings } from '../../../types';

import type {
  Bip32Derivation,
  TapBip32Derivation,
} from 'bip174/src/lib/interfaces';
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

// psbtToTx
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

export function getPsbtBtcDefault({
  network,
}: {
  network: IBtcForkNetwork;
}): Psbt {
  return new Psbt({ network });
}

// txToPsbt
export async function buildPsbt({
  network,
  unsignedTx,
  btcExtraInfo,
  buildInputMixinInfo,
  getPsbt = getPsbtBtcDefault,
}: {
  unsignedTx: IUnsignedTxPro;
  btcExtraInfo: ICoreApiSignBtcExtraInfo | undefined;
  network: IBtcForkNetwork;
  getPsbt?: (params: { network: IBtcForkNetwork }) => Psbt;
  // psbtGlobalUpdate: PsbtGlobalUpdate;
  buildInputMixinInfo: (params: { address: string }) => Promise<{
    pubkey: Buffer | undefined;
    bip32Derivation?: Bip32Derivation[] | TapBip32Derivation[];
  }>;
}) {
  const { inputs, outputs } = unsignedTx.encodedTx as IEncodedTxBtc;

  const inputAddressesEncodings = checkIsDefined(
    btcExtraInfo?.inputAddressesEncodings,
  );

  const psbt = getPsbt({ network });

  // psbt.updateGlobal({
  // })

  const fixMixinOfTaproot = ({
    mixin,
    bip32Derivation,
  }: {
    mixin: IBtcForkTransactionMixin;
    bip32Derivation: Bip32Derivation[] | TapBip32Derivation[] | undefined;
  }) => {
    // not allowed bip32Derivation for taproot
    // https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/psbt/bip371.js#L236
    delete mixin.bip32Derivation;
    if (bip32Derivation) {
      mixin.tapBip32Derivation = bip32Derivation.map((item) => ({
        ...item,
        pubkey: toXOnly(item.pubkey),
        leafHashes: [], // TODO how to build leafHashes
      }));
    }
  };

  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i];

    const inputValue: number = new BigNumber(input.value).toNumber();
    const encoding = inputAddressesEncodings[i];
    if (!encoding) {
      throw new Error(`inputAddressesEncodings missing encoding at index ${i}`);
    }

    const { pubkey, bip32Derivation } = await buildInputMixinInfo({
      address: input.address,
    });

    const mixinInput: IBtcForkTransactionMixin = {};
    if (!isEmpty(bip32Derivation)) {
      mixinInput.bip32Derivation = bip32Derivation;
    }

    switch (encoding) {
      case EAddressEncodings.P2PKH: {
        const nonWitnessPrevTxs = checkIsDefined(
          btcExtraInfo?.nonWitnessPrevTxs,
        );
        mixinInput.nonWitnessUtxo = Buffer.from(
          nonWitnessPrevTxs[input.txid],
          'hex',
        );
        break;
      }
      case EAddressEncodings.P2WPKH: {
        const payment = checkIsDefined(
          pubkeyToPayment({
            pubkey,
            encoding,
            network,
          }),
        );
        mixinInput.witnessUtxo = {
          script: payment.output as Buffer,
          value: inputValue,
        };
        break;
      }
      case EAddressEncodings.P2SH_P2WPKH: {
        const payment = checkIsDefined(
          pubkeyToPayment({
            pubkey,
            encoding,
            network,
          }),
        );
        mixinInput.witnessUtxo = {
          script: payment.output as Buffer,
          value: inputValue,
        };
        mixinInput.redeemScript = payment.redeem?.output as Buffer;
        break;
      }
      case EAddressEncodings.P2TR: {
        const payment = checkIsDefined(
          pubkeyToPayment({
            pubkey,
            encoding,
            network,
          }),
        );
        mixinInput.witnessUtxo = {
          script: payment.output as Buffer,
          value: inputValue,
        };
        mixinInput.tapInternalKey = payment.internalPubkey;

        fixMixinOfTaproot({ mixin: mixinInput, bip32Derivation });
        break;
      }
      default:
        break;
    }

    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      ...mixinInput,
    });
  }

  for (const output of outputs) {
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
      const mixinOutput: IBtcForkTransactionMixin = {};

      // Change output needs to mark bip32Derivation to facilitate hardware to calculate the actual amount of transfer
      if (output?.payload?.isChange) {
        try {
          const { pubkey, bip32Derivation } = await buildInputMixinInfo({
            address: output.address,
          });
          if (!isEmpty(bip32Derivation)) {
            mixinOutput.bip32Derivation = bip32Derivation;
          }
          if (isTaprootAddress(output.address)) {
            const payment = checkIsDefined(
              pubkeyToPayment({
                pubkey,
                encoding: EAddressEncodings.P2TR,
                network,
              }),
            );
            mixinOutput.tapInternalKey = payment.internalPubkey;
            fixMixinOfTaproot({ mixin: mixinOutput, bip32Derivation });
          }
        } catch (error) {
          //
        }
      }

      psbt.addOutput({
        address: output.address,
        value: outputValue,
        ...mixinOutput,
      });
    }
  }

  // add uuid for verifyPsbtSignMatched() check
  psbt.addUnknownKeyValToGlobal({
    key: Buffer.from('$OnekeyPsbtUUID', 'utf-8'),
    value: Buffer.from(generateUUID(), 'utf-8'),
  });

  return psbt;
}
