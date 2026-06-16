import { Script } from '@onekeyfe/kaspa-core-lib';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  BASE_KAS_TO_P2SH_ADDRESS,
  DEFAULT_FEE_RATE,
  DUST_AMOUNT,
} from '../constant';
import { EKaspaSignType } from '../publickey';
import { SignatureType } from '../transaction';
import { EOpcodes } from '../types';

import type { IEncodedTxKaspa } from '../../types';
import type { IKaspaTransaction } from '../types';
import type { KaspaSignTransactionParams } from '@onekeyfe/hd-core';
import type { IScriptPublicKey, ITransactionInput } from '@onekeyfe/kaspa-wasm';

const getKaspaApi = async () => {
  const Loader = await import('@onekeyfe/kaspa-wasm');
  await Loader.default();

  const createKRC20RevealTx = async (params: {
    accountAddress: string;
    encodedTx: IEncodedTxKaspa;
    isTestnet: boolean;
  }) => {
    const {
      createTransaction,
      createTransactions,
      calculateTransactionFee,
      kaspaToSompi,
    } = Loader;
    const { accountAddress, encodedTx, isTestnet } = params;
    const input = encodedTx.inputs[0];
    const kaspaNetworkId = isTestnet ? 'testnet-10' : 'mainnet';

    const revealEntries: any = [
      {
        address: input.address,
        amount: kaspaToSompi(BASE_KAS_TO_P2SH_ADDRESS) as bigint,
        outpoint: {
          transactionId: input.txid,
          index: 0,
        },
        scriptPublicKey: `0000${input.scriptPubKey}`,
        blockDaaScore: input.blockDaaScore,
        isCoinbase: false,
      },
    ];

    const tx = createTransaction(revealEntries, [], BigInt(0));

    // The reveal tx must be priced at the network fee rate the commit tx used,
    // NOT the protocol base minimum. calculateTransactionFee() only returns the
    // base minimum (~1 sompi/gram); when the node's minimum relay fee rate is
    // elevated (network congestion), a base-minimum reveal is rejected as
    // non-standard ("transaction ... is under the required amount ... for compute
    // mass ..."). The commit carries the chosen fee rate (sompi/gram) on
    // feeInfo.price, so scale the base fee up to that rate. This is an output-less
    // compound tx, where the generator uses priorityFee as the exact fee, and the
    // 1.3 KAS input leaves ample room for the higher fee. When the network is idle
    // (price falls back to DEFAULT_FEE_RATE = 1) this keeps the previous behavior.
    const baseFee = calculateTransactionFee(kaspaNetworkId, tx) ?? BigInt(0);
    const feeRate = Number(encodedTx.feeInfo?.price) || DEFAULT_FEE_RATE;
    let priorityFee = BigInt(Math.ceil(Number(baseFee) * feeRate));

    // Cap the priority fee so the reveal always has room to land. The reveal's
    // only input is the fixed 1.3 KAS P2SH output; if `baseFee * feeRate` (which
    // scales with the network rate and the x2 buffer) exceeds `input - dust`,
    // createTransactions throws "insufficient funds" and the reveal can never be
    // broadcast, permanently locking the commit's KAS in the P2SH output. Better
    // to slightly underpay the buffer than to strand the funds.
    const revealInput = kaspaToSompi(BASE_KAS_TO_P2SH_ADDRESS) as bigint;
    const maxPriorityFee = revealInput - BigInt(DUST_AMOUNT);
    if (priorityFee > maxPriorityFee) {
      priorityFee = maxPriorityFee;
    }

    const settings = {
      priorityEntries: revealEntries,
      entries: revealEntries,
      outputs: [],
      changeAddress: encodedTx.changeAddress ?? accountAddress,
      priorityFee,
      networkId: kaspaNetworkId,
    };
    const { transactions } = await createTransactions(settings);

    const transaction = transactions[0];

    return transaction;
  };

  return {
    createKRC20RevealTxJSON: async (params: {
      accountAddress: string;
      encodedTx: IEncodedTxKaspa;
      isTestnet: boolean;
    }) => {
      const transacting = await createKRC20RevealTx(params);
      return transacting.serializeToSafeJSON();
    },
    buildCommitTxInfo: async ({
      accountAddress,
      transferDataString,
      isTestnet,
    }: {
      accountAddress: string;
      transferDataString: string;
      isTestnet: boolean;
    }) => {
      const {
        XOnlyPublicKey,
        Address,
        ScriptBuilder,
        addressFromScriptPublicKey,
        NetworkType,
      } = Loader;
      const xOnlyPublicKey = XOnlyPublicKey.fromAddress(
        new Address(accountAddress),
      );
      const script = new ScriptBuilder()
        .addData(xOnlyPublicKey.toString())
        .addOp(EOpcodes.OpCheckSig)
        .addOp(EOpcodes.OpFalse)
        .addOp(EOpcodes.OpIf)
        .addData(new Uint8Array(Buffer.from('kasplex')))
        .addI64(0n)
        .addData(new Uint8Array(Buffer.from(transferDataString)))
        .addOp(EOpcodes.OpEndIf);

      const scriptPublicKey = script.createPayToScriptHashScript();
      const P2SHAddress = addressFromScriptPublicKey(
        scriptPublicKey,
        isTestnet ? NetworkType.Testnet : NetworkType.Mainnet,
      );

      return Promise.resolve({
        commitScriptPubKey: scriptPublicKey.script,
        commitAddress: P2SHAddress?.toString() ?? '',
        commitScriptHex: script.toString(),
      });
    },

    signRevealTransactionSoftware: async (params: {
      accountAddress: string;
      encodedTx: IEncodedTxKaspa;
      isTestnet: boolean;
      tweakedPrivateKey: string;
    }) => {
      const { ScriptBuilder, PrivateKey } = Loader;
      const { accountAddress, encodedTx, isTestnet, tweakedPrivateKey } =
        params;

      if (!encodedTx.commitScriptHex) {
        throw new OneKeyLocalError('Invalid P2SH commitScriptHex');
      }

      const privateKey = new PrivateKey(tweakedPrivateKey);

      const transaction = await createKRC20RevealTx({
        accountAddress,
        encodedTx,
        isTestnet,
      });

      transaction.sign([privateKey], false);

      const ourOutput = transaction.transaction.inputs.findIndex(
        (i) => i.signatureScript === '',
      );

      if (ourOutput !== -1) {
        const signature = transaction.createInputSignature(
          ourOutput,
          privateKey,
        );
        const script = ScriptBuilder.fromScript(encodedTx.commitScriptHex);
        transaction.fillInput(
          ourOutput,
          script.encodePayToScriptHashSignatureScript(signature),
        );
      }

      return transaction.transaction.serializeToSafeJSON();
    },

    signRevealTransactionHardware: async (params: {
      accountAddress: string;
      encodedTx: IEncodedTxKaspa;
      isTestnet: boolean;
      signatures: {
        signature: string;
        index: number;
      }[];
    }) => {
      const { ScriptBuilder } = Loader;
      const { accountAddress, encodedTx, isTestnet, signatures } = params;

      if (!encodedTx.commitScriptHex) {
        throw new OneKeyLocalError('Invalid P2SH commitScriptHex');
      }

      const revealTx = await createKRC20RevealTx({
        accountAddress,
        encodedTx,
        isTestnet,
      });

      const script = ScriptBuilder.fromScript(encodedTx.commitScriptHex);

      signatures.forEach((item) => {
        const signature = Script.buildPublicKeyIn(
          Buffer.from(item.signature, 'hex'),
          SignatureType.SIGHASH_ALL,
        )
          .toBuffer()
          .toString('hex');
        revealTx.fillInput(
          item.index,
          script.encodePayToScriptHashSignatureScript(signature),
        );
      });

      return revealTx.transaction.serializeToSafeJSON();
    },

    buildUnsignedTxForHardware: async (params: {
      encodedTx: IEncodedTxKaspa;
      isTestnet: boolean;
      accountAddress: string;
      path: string;
      chainId: string;
    }) => {
      const { encodedTx, isTestnet, accountAddress, path, chainId } = params;

      const revealTx = await createKRC20RevealTx({
        encodedTx,
        isTestnet,
        accountAddress,
      });

      const unSignTx: KaspaSignTransactionParams = {
        version: revealTx.transaction.version,
        inputs: revealTx.transaction.inputs.map((input: ITransactionInput) => ({
          path,
          prevTxId: input.previousOutpoint?.transactionId,
          outputIndex: input.previousOutpoint?.index,
          sequenceNumber: input.sequence.toString(),
          output: {
            satoshis: input.utxo?.amount.toString() ?? '',
            script: input.utxo?.scriptPublicKey.script ?? '',
          },
          sigOpCount: input.sigOpCount,
        })),
        outputs: revealTx.transaction.outputs.map((output) => ({
          satoshis: output.value.toString(),
          script:
            typeof output.scriptPublicKey === 'string'
              ? output.scriptPublicKey
              : (output.scriptPublicKey as IScriptPublicKey).script,
          scriptVersion: 0,
        })),
        lockTime: revealTx.transaction.lockTime.toString(),
        sigHashType: SignatureType.SIGHASH_ALL,
        sigOpCount: 1,
        scheme: EKaspaSignType.Schnorr,
        prefix: chainId,
      };

      return unSignTx;
    },
    deserializeFromSafeJSON: async (
      json: string,
    ): Promise<IKaspaTransaction> => {
      const { Transaction } = Loader;
      const tx = Transaction.deserializeFromSafeJSON(json);
      return {
        version: tx.version,
        // @ts-expect-error
        inputs: tx.inputs.map((input) => ({
          previousOutpoint: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            transactionId: input.previousOutpoint.transactionId,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            index: input.previousOutpoint.index,
          },
          signatureScript: input.signatureScript,
          sequence: input.sequence.toString(),
          sigOpCount: input.sigOpCount,
        })),
        // @ts-expect-error
        outputs: tx.outputs.map((output) => ({
          amount: output.value.toString(),
          ...(typeof output.scriptPublicKey === 'object'
            ? {
                scriptPublicKey: {
                  version: output.scriptPublicKey.version,
                  scriptPublicKey: output.scriptPublicKey.script,
                },
              }
            : {
                scriptPublicKey: output.scriptPublicKey,
              }),
        })),
        mass: tx.mass.toString(),
        // @ts-expect-error
        lockTime: tx.lockTime.toString(),
        subnetworkId: tx.subnetworkId,
        // @ts-expect-error
        gas: tx.gas?.toString() ?? '0',
        payload: tx.payload,
      };
    },
  };
};

export default {
  getKaspaApi,
};
