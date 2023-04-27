import { BigNumber } from 'bignumber.js';

import { CONFIRMATION_COUNT } from './constant';
import { UnspentOutput } from './types';

import type { RestAPIClient } from './clientRestApi';
import type { UTXOResponse } from './types';

function sortUXTO(utxos: UnspentOutput[]) {
  return utxos.sort(
    (a: UnspentOutput, b: UnspentOutput): number =>
      a.blockDaaScore - b.blockDaaScore ||
      b.satoshis - a.satoshis ||
      a.txId.localeCompare(b.txId) ||
      a.outputIndex - b.outputIndex,
  );
}

function formatUtxo(entries: UTXOResponse[]): UnspentOutput[] {
  const result: UnspentOutput[] = [];

  for (const entry of entries) {
    const { transactionId, index } = entry.outpoint;
    const { address, utxoEntry } = entry;
    const { amount, scriptPublicKey, blockDaaScore } = utxoEntry;

    const item: UnspentOutput = new UnspentOutput({
      txid: transactionId,
      address,
      vout: index,
      scriptPubKey: scriptPublicKey.scriptPublicKey,
      scriptPublicKeyVersion: scriptPublicKey.version ?? 0,
      satoshis: +amount,
      blockDaaScore: parseInt(blockDaaScore),
    });
    result.push(item);
  }

  return result;
}

export async function queryConfirmUTXOs(
  client: RestAPIClient,
  address: string,
) {
  const networkInfo = await client.getNetworkInfo();
  const utxos = await client.queryUtxos(address);
  const blueScore = new BigNumber(networkInfo.virtualDaaScore);

  const confirmedUtxos = utxos.filter((u) =>
    blueScore
      .minus(u.utxoEntry.blockDaaScore)
      .isGreaterThanOrEqualTo(CONFIRMATION_COUNT),
  );

  return Promise.resolve(formatUtxo(confirmedUtxos));
}

export function selectUTXOs(
  confirmUtxos: UnspentOutput[],
  txAmount: number,
): {
  utxoIds: string[];
  utxos: UnspentOutput[];
  mass: number;
} {
  const sortedUtxos = sortUXTO(confirmUtxos);

  const selectedUtxos: UnspentOutput[] = [];
  const utxoIds: string[] = [];
  let totalVal = 0;
  let mass = 0;

  for (const utxo of sortedUtxos) {
    // if (!this.inUse.includes(utxoId)) {
    utxoIds.push(utxo.id);
    selectedUtxos.push(utxo);
    mass += utxo.mass;
    totalVal += utxo.satoshis;
    // }
    if (totalVal >= txAmount) break;
  }

  if (totalVal < txAmount)
    throw new Error(
      `Insufficient balance - need: ${txAmount} KAS, available: ${txAmount} KAS`,
    );

  return {
    utxoIds,
    utxos: selectedUtxos,
    mass,
  };
}
