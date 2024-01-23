import { BigNumber } from 'bignumber.js';

import { InsufficientBalance } from '../../../../errors';

import { CONFIRMATION_COUNT } from './constant';
import { UnspentOutput } from './types';

import type { RestAPIClient } from './clientRestApi';
import type { UTXOResponse, UnspentOutputInfo } from './types';

function sortUXTO(
  utxos: UnspentOutputInfo[],
  prioritys?: { satoshis: boolean },
) {
  return utxos.sort((a: UnspentOutputInfo, b: UnspentOutputInfo): number => {
    if (prioritys?.satoshis) {
      return (
        b.satoshis - a.satoshis ||
        a.blockDaaScore - b.blockDaaScore ||
        a.txid.localeCompare(b.txid) ||
        a.vout - b.vout
      );
    }

    return (
      a.blockDaaScore - b.blockDaaScore ||
      b.satoshis - a.satoshis ||
      a.txid.localeCompare(b.txid) ||
      a.vout - b.vout
    );
  });
}

function formatUtxo(entries: UTXOResponse[]): UnspentOutputInfo[] {
  const result: UnspentOutputInfo[] = [];

  for (const entry of entries) {
    const { transactionId, index } = entry.outpoint;
    const { address, utxoEntry } = entry;
    const { amount, scriptPublicKey, blockDaaScore } = utxoEntry;

    const item: UnspentOutputInfo = {
      txid: transactionId,
      address,
      vout: index,
      scriptPubKey: scriptPublicKey.scriptPublicKey,
      scriptPublicKeyVersion: scriptPublicKey.version ?? 0,
      satoshis: +amount,
      blockDaaScore: parseInt(blockDaaScore),
    };
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
  confirmUtxos: UnspentOutputInfo[],
  txAmount: number,
  prioritys?: { satoshis: boolean },
): {
  utxoIds: string[];
  utxos: UnspentOutputInfo[];
  mass: number;
} {
  const sortedUtxos = sortUXTO(confirmUtxos, prioritys);

  const selectedUtxos: UnspentOutputInfo[] = [];
  const utxoIds: string[] = [];
  let totalVal = 0;
  let mass = 0;

  for (const info of sortedUtxos) {
    // if (!this.inUse.includes(utxoId)) {
    const utxo = new UnspentOutput(info);
    utxoIds.push(utxo.id);
    selectedUtxos.push(info);
    mass += utxo.mass;
    totalVal += utxo.satoshis;
    // }
    if (totalVal >= txAmount) break;
  }

  if (totalVal < txAmount)
    throw new InsufficientBalance(
      `Insufficient balance - need: ${txAmount} KAS, available: ${txAmount} KAS`,
    );

  return {
    utxoIds,
    utxos: selectedUtxos,
    mass,
  };
}
