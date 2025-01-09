import { BigNumber } from 'bignumber.js';

import { MAX_UINT64_VALUE } from '@onekeyhq/core/src/consts';
import { LowerTransactionAmountError } from '@onekeyhq/shared/src/errors';

import { CONFIRMATION_COUNT } from './constant';
import { UnspentOutput } from './types';

import type { RestAPIClient } from './clientRestApi';
import type { IKaspaUTXOResponse, IKaspaUnspentOutputInfo } from './types';

type ISortKey = 'daaScore' | 'satoshis';

function sortUXTO(
  utxos: IKaspaUnspentOutputInfo[],
  sortPriority: ISortKey = 'daaScore',
) {
  const sortFns = {
    daaScore: (a: IKaspaUnspentOutputInfo, b: IKaspaUnspentOutputInfo) =>
      a.blockDaaScore - b.blockDaaScore,
    satoshis: (a: IKaspaUnspentOutputInfo, b: IKaspaUnspentOutputInfo) =>
      new BigNumber(b.satoshis).minus(a.satoshis).toNumber(),
  };

  return utxos.sort(
    (a, b) =>
      sortFns[sortPriority](a, b) ||
      sortFns[sortPriority === 'daaScore' ? 'satoshis' : 'daaScore'](a, b) ||
      a.txid.localeCompare(b.txid) ||
      a.vout - b.vout,
  );
}

function formatUtxo(entries: IKaspaUTXOResponse[]): IKaspaUnspentOutputInfo[] {
  const result: IKaspaUnspentOutputInfo[] = [];

  for (const entry of entries) {
    const { transactionId, index } = entry.outpoint;
    const { address, utxoEntry } = entry;
    const { amount, scriptPublicKey, blockDaaScore } = utxoEntry;

    const item: IKaspaUnspentOutputInfo = {
      txid: transactionId,
      address,
      vout: index,
      scriptPubKey: scriptPublicKey.scriptPublicKey,
      scriptPublicKeyVersion: scriptPublicKey.version ?? 0,
      satoshis: Array.isArray(amount) ? amount[0] : amount,
      blockDaaScore: parseInt(blockDaaScore, 10),
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
  confirmUtxos: IKaspaUnspentOutputInfo[],
  txAmount: BigNumber,
  prioritys?: { satoshis: boolean },
): {
  utxoIds: string[];
  utxos: IKaspaUnspentOutputInfo[];
  prioritys?: { satoshis: boolean };
  mass: number;
} {
  const sortedUtxos = sortUXTO(
    confirmUtxos,
    prioritys?.satoshis ? 'satoshis' : 'daaScore',
  );

  const selectedUtxos: IKaspaUnspentOutputInfo[] = [];
  const utxoIds: string[] = [];
  let totalVal = new BigNumber(0);
  let mass = 0;

  for (const info of sortedUtxos) {
    // if (!this.inUse.includes(utxoId)) {
    const utxo = new UnspentOutput(info);
    utxoIds.push(utxo.id);
    selectedUtxos.push(info);
    mass += utxo.mass;
    totalVal = totalVal.plus(utxo.satoshis);
    // }
    if (totalVal.isGreaterThanOrEqualTo(txAmount)) break;
  }

  if (totalVal.isLessThan(txAmount)) throw new LowerTransactionAmountError();

  // Uint64 overflow
  if (totalVal.isGreaterThan(MAX_UINT64_VALUE)) {
    // utxo amount is too large
    throw new Error('utxo amount is too large');
  }

  return {
    utxoIds,
    utxos: selectedUtxos,
    mass,
  };
}
