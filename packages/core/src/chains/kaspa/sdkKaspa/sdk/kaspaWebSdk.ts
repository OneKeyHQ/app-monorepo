import { Script } from '@onekeyfe/kaspa-core-lib';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { DEFAULT_FEE_RATE } from '../constant';
import { EKaspaSignType } from '../publickey';
import { SignatureType } from '../transaction';

import type { IEncodedTxKaspa } from '../../types';
import type { IKaspaTransaction } from '../types';
import type { KaspaSignTransactionParams } from '@onekeyfe/hd-core';
import type { ITransactionInput } from '@onekeyfe/kaspa-wasm';

const getKaspaApi = async () => {
  const Loader = await import('@onekeyfe/kaspa-wasm');
  await Loader.default();

  // Build the wasm pending tx for the single-tx KRC20 payload transfer: an
  // output-less P2PK self-sweep (one change output back to self) carrying the
  // kasplex op JSON in the consensus payload. Deterministic for the same
  // inputs/fee, so the hardware path can build it once for the device-side
  // sighash params and again to reconstruct the tx from the returned signatures.
  const buildPayloadPendingTx = async (params: {
    accountAddress: string;
    encodedTx: IEncodedTxKaspa;
    isTestnet: boolean;
  }) => {
    const { createTransaction, createTransactions, calculateTransactionFee } =
      Loader;
    const { accountAddress, encodedTx, isTestnet } = params;

    if (!encodedTx.payload) {
      throw new OneKeyLocalError('Invalid payload');
    }

    const networkId = isTestnet ? 'testnet-10' : 'mainnet';

    const entries: any = encodedTx.inputs.map((input) => ({
      address: input.address,
      amount: BigInt(input.satoshis),
      outpoint: {
        transactionId: input.txid,
        index: input.vout,
      },
      scriptPublicKey: `0000${input.scriptPubKey}`,
      blockDaaScore: input.blockDaaScore,
      isCoinbase: false,
    }));

    // Output-less self-sweep: priorityFee is the EXACT fee. Scale the base
    // compute-mass fee by the selected feerate (×2 safety) so the tx clears the
    // node's elevated minimum-relay-fee rate during congestion.
    const probeTx = createTransaction(
      entries,
      [],
      BigInt(0),
      encodedTx.payload,
    );
    const baseFee = calculateTransactionFee(networkId, probeTx) ?? BigInt(0);
    const feeRate = Number(encodedTx.feeInfo?.price) || DEFAULT_FEE_RATE;
    const SAFETY_MULTIPLIER = 2;
    const priorityFee = BigInt(
      Math.ceil(Number(baseFee) * feeRate * SAFETY_MULTIPLIER),
    );

    const settings: any = {
      entries,
      outputs: [],
      changeAddress: encodedTx.changeAddress ?? accountAddress,
      priorityFee,
      networkId,
      payload: encodedTx.payload,
    };

    const { transactions } = await createTransactions(settings);
    return transactions[0];
  };

  return {
    // Single-tx KRC20 transfer (software signing): sign the payload-carrying
    // P2PK self-sweep with the tweaked private key.
    signPayloadTransactionSoftware: async (params: {
      accountAddress: string;
      encodedTx: IEncodedTxKaspa;
      isTestnet: boolean;
      tweakedPrivateKey: string;
    }) => {
      const { PrivateKey } = Loader;
      const { accountAddress, encodedTx, isTestnet, tweakedPrivateKey } = params;
      const pendingTx = await buildPayloadPendingTx({
        accountAddress,
        encodedTx,
        isTestnet,
      });
      // The kaspa-wasm 2.0.x build signs the payload into the sighash (and the
      // tx carries the Crescendo compute_budget field), so the standard sign is
      // correct here.
      pendingTx.sign([new PrivateKey(tweakedPrivateKey)], false);
      return pendingTx.transaction.serializeToSafeJSON();
    },

    // Single-tx KRC20 transfer (hardware signing): rebuild the same payload
    // P2PK self-sweep and fill each input with the device's schnorr signature
    // (P2PK signatureScript = pushed signature).
    signPayloadTransactionHardware: async (params: {
      accountAddress: string;
      encodedTx: IEncodedTxKaspa;
      isTestnet: boolean;
      signatures: {
        signature: string;
        index: number;
      }[];
    }) => {
      const { accountAddress, encodedTx, isTestnet, signatures } = params;
      const pendingTx = await buildPayloadPendingTx({
        accountAddress,
        encodedTx,
        isTestnet,
      });
      signatures.forEach((item) => {
        const signatureScript = Script.buildPublicKeyIn(
          Buffer.from(item.signature, 'hex'),
          SignatureType.SIGHASH_ALL,
        )
          .toBuffer()
          .toString('hex');
        pendingTx.fillInput(item.index, signatureScript);
      });
      return pendingTx.transaction.serializeToSafeJSON();
    },

    buildUnsignedTxForHardware: async (params: {
      encodedTx: IEncodedTxKaspa;
      isTestnet: boolean;
      accountAddress: string;
      path: string;
      chainId: string;
    }) => {
      const { encodedTx, isTestnet, accountAddress, path, chainId } = params;

      if (!encodedTx.payload) {
        throw new OneKeyLocalError('Invalid payload');
      }

      const pendingTx = await buildPayloadPendingTx({
        accountAddress,
        encodedTx,
        isTestnet,
      });

      const unSignTx: KaspaSignTransactionParams = {
        version: pendingTx.transaction.version,
        inputs: pendingTx.transaction.inputs.map(
          (input: ITransactionInput) => ({
            path,
            prevTxId: input.previousOutpoint?.transactionId,
            outputIndex: input.previousOutpoint?.index,
            sequenceNumber: input.sequence.toString(),
            output: {
              satoshis: input.utxo?.amount.toString() ?? '',
              script: input.utxo?.scriptPublicKey.script ?? '',
            },
            sigOpCount: input.sigOpCount,
          }),
        ),
        outputs: pendingTx.transaction.outputs.map((output) => ({
          satoshis: output.value.toString(),
          // Streaming protocol describes outputs by address; the payload
          // self-sweep returns funds to the change address, so the device
          // rebuilds the script from it. Must match the wasm tx's change address
          // or the device-side sighash won't match.
          address: encodedTx.changeAddress ?? accountAddress,
        })),
        lockTime: pendingTx.transaction.lockTime.toString(),
        sigHashType: SignatureType.SIGHASH_ALL,
        sigOpCount: 1,
        scheme: EKaspaSignType.Schnorr,
        prefix: chainId,
        // Carry the consensus payload so the device commits it into the sighash
        // (requires the streaming-protocol SDK; the old per-input SDK ignores it).
        payload: encodedTx.payload,
      };

      return unSignTx;
    },
    // Broadcast a signed payload tx over the node-native wRPC JSON endpoint via a
    // plain WebSocket (no RpcClient/Resolver/Borsh). The REST paths (api.kaspa.org
    // and the OneKey proxy) strip the consensus `payload`; the node's JSON wRPC
    // takes the full RpcTransaction (payload = hex), so the node validates exactly
    // what we signed. We only use the wasm to deserialize the signed rawTx into a
    // typed tx, then hand-build the RpcTransaction JSON and submit it as JSON-RPC.
    submitPayloadTransactionViaRpc: async (params: {
      rawTx: string;
      isTestnet: boolean;
    }): Promise<string> => {
      const { Transaction } = Loader;
      const { rawTx, isTestnet } = params;

      const tx = Transaction.deserializeFromSafeJSON(rawTx);

      // scriptPublicKey wire format = u16-LE version prefix + script hex.
      const leU16Hex = (n: number) => {
        const v = Number(n) & 0xffff;
        return (
          (v & 0xff).toString(16).padStart(2, '0') +
          ((v >> 8) & 0xff).toString(16).padStart(2, '0')
        );
      };
      /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
      const packSpk = (spk: any) =>
        typeof spk === 'string' ? spk : leU16Hex(spk.version) + spk.script;

      const rpcTx = {
        version: tx.version,
        inputs: (tx.inputs as any[]).map((i: any) => ({
          previousOutpoint: {
            transactionId: i.previousOutpoint.transactionId,
            index: i.previousOutpoint.index,
          },
          signatureScript: i.signatureScript,
          sequence: i.sequence,
          sigOpCount: i.sigOpCount,
          // Crescendo: node derives the sighash sig_op_count from computeBudget;
          // omitting it => different sighash => signature rejected.
          computeBudget: i.computeBudget,
        })),
        outputs: (tx.outputs as any[]).map((o: any) => ({
          value: o.value,
          scriptPublicKey: packSpk(o.scriptPublicKey),
          covenant: null,
        })),
        lockTime: tx.lockTime,
        subnetworkId: tx.subnetworkId,
        gas: (tx as any).gas ?? 0,
        mass: 0,
        storageMass: 0,
        payload: tx.payload,
      };
      /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

      const request = {
        id: 1,
        method: 'submitTransaction',
        params: { transaction: rpcTx, allowOrphan: false },
      };
      // JSON.stringify can't emit BigInt (wasm u64 accessors return BigInt), so
      // tag BigInts and unquote them into bare JSON integers to keep full u64.
      const body = JSON.stringify(request, (_k, v) =>
        typeof v === 'bigint' ? `@@B@@${v.toString()}@@B@@` : v,
      ).replace(/"@@B@@(\d+)@@B@@"/g, '$1');
      // eslint-disable-next-line no-console
      console.log('[KSPWS] submitTransaction body >>>', body);

      const net = isTestnet ? 'testnet-10' : 'mainnet';
      // Public kaspa nodes with wRPC JSON enabled (community PNN). Tried in order;
      // connection failures fall through to the next. NOT for production — these
      // are volunteer nodes; run your own node with --rpclisten-json for that.
      const hosts = [
        'emma.kaspa.stream',
        'mark.kaspa.green',
        'alex.kaspa.red',
        'noah.kaspa.blue',
      ];
      const nodeUrls = hosts.map((h) => `wss://${h}/kaspa/${net}/wrpc/json`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const WS: any = (globalThis as any).WebSocket;
      if (!WS) {
        throw new OneKeyLocalError('WebSocket unavailable for Kaspa JSON-RPC');
      }

      // Resolves { txid } or { rejected } on a node response; rejects on a
      // connection-level failure (so the caller can try the next node).
      const submitTo = (url: string) =>
        new Promise<{ txid?: string; rejected?: string }>(
          (resolve, reject) => {
            let settled = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let ws: any;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                try {
                  ws?.close();
                } catch {
                  // ignore
                }
                reject(new OneKeyLocalError(`Kaspa JSON-RPC timeout: ${url}`));
              }
            }, 20000);
            try {
              ws = new WS(url);
            } catch (e) {
              clearTimeout(timer);
              reject(e as Error);
              return;
            }
            ws.onopen = () => {
              // eslint-disable-next-line no-console
              console.log('[KSPWS] connected, submitting via >>>', url);
              ws.send(body);
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ws.onmessage = (ev: any) => {
              if (settled) return;
              settled = true;
              // eslint-disable-next-line no-console
              console.log('[KSPWS] node response <<<', String(ev.data));
              clearTimeout(timer);
              try {
                ws.close();
              } catch {
                // ignore
              }
              try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const resp = JSON.parse(String(ev.data));
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (resp.error) {
                  resolve({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    rejected: resp.error.message || 'submit error',
                  });
                  return;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const txid = resp?.params?.transactionId;
                resolve(
                  txid
                    ? { txid }
                    : { rejected: `unexpected response: ${String(ev.data)}` },
                );
              } catch (e) {
                reject(e as Error);
              }
            };
            ws.onerror = () => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(new OneKeyLocalError(`Kaspa JSON-RPC ws error: ${url}`));
              }
            };
          },
        );

      let lastConnErr: unknown;
      for (const url of nodeUrls) {
        let r: { txid?: string; rejected?: string };
        try {
          // eslint-disable-next-line no-await-in-loop
          r = await submitTo(url);
        } catch (connErr) {
          lastConnErr = connErr;
          continue;
        }
        if (r.txid) return r.txid;
        // Definitive node rejection — the tx itself is bad; stop retrying.
        throw new OneKeyLocalError(r.rejected || 'Kaspa submit rejected');
      }
      throw lastConnErr instanceof Error
        ? lastConnErr
        : new OneKeyLocalError('Kaspa JSON-RPC broadcast failed (all nodes)');
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
          // Crescendo: the node derives the sighash sig_op_count from this field;
          // omitting it makes the node compute a different sighash (rejected).
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          computeBudget: input.computeBudget,
        })),
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
