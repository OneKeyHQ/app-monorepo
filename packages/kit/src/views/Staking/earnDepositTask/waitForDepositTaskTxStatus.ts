import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import type { IDepositTaskIdentity } from './state';

type ICandidate = { txid: string; isCancel: boolean };

export async function waitForDepositTaskTxStatus({
  identity,
  txid,
  signal,
  maxAttempts,
}: {
  identity: Pick<
    IDepositTaskIdentity,
    'accountId' | 'accountAddress' | 'networkId'
  >;
  txid: string;
  signal: AbortSignal;
  maxAttempts?: number;
}): Promise<'success' | 'failed' | 'unknown'> {
  const { accountId, accountAddress, networkId } = identity;
  const candidates: ICandidate[] = [{ txid, isCancel: false }];

  const check = (candidate: ICandidate, attempts?: number) =>
    waitForTxFinalStatus({
      accountId,
      networkId,
      txid: candidate.txid,
      signal,
      maxAttempts: attempts,
    }).catch(() => undefined);

  const originalStatus = await check(candidates[0], 1);
  if (signal.aborted) return 'unknown';
  if (originalStatus === EOnChainHistoryTxStatus.Success) return 'success';
  if (originalStatus === EOnChainHistoryTxStatus.Failed) return 'failed';

  try {
    const xpub = await backgroundApiProxy.serviceAccount.getAccountXpub({
      accountId,
      networkId,
    });
    let historyId = accountUtils.buildLocalHistoryId({
      accountAddress,
      networkId,
      txid,
      xpub,
    });
    const visited = new Set<string>();
    let hasReplacement = false;
    let isCancel = false;
    while (
      !signal.aborted &&
      historyId &&
      !visited.has(historyId) &&
      visited.size < 32
    ) {
      visited.add(historyId);
      const history =
        await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
          accountId,
          networkId,
          historyId,
        });
      if (!history) break;
      if (hasReplacement) {
        if (
          !history.decodedTx.txid ||
          (history.replacedType !== EReplaceTxType.SpeedUp &&
            history.replacedType !== EReplaceTxType.Cancel)
        )
          break;
        isCancel ||= history.replacedType === EReplaceTxType.Cancel;
        if (
          !candidates.some(
            (candidate) => candidate.txid === history.decodedTx.txid,
          )
        ) {
          candidates.push({ txid: history.decodedTx.txid, isCancel });
        }
      }
      if (!history.replacedNextId) break;
      hasReplacement = true;
      historyId = history.replacedNextId;
    }
  } catch {
    // Keep checking the known transaction hashes when local history is unavailable.
    if (signal.aborted) return 'unknown';
  }
  if (signal.aborted) return 'unknown';

  // Replacements race for the same nonce: any recorded candidate may be mined.
  const replacements = candidates.slice(1);
  const statuses = await Promise.all(
    replacements.map((candidate) => check(candidate, 1)),
  );
  if (signal.aborted) return 'unknown';
  const terminal = replacements.flatMap((candidate, index) => {
    const status = statuses[index];
    return status === EOnChainHistoryTxStatus.Success ||
      status === EOnChainHistoryTxStatus.Failed
      ? [{ candidate, status }]
      : [];
  });
  if (terminal.length > 1) return 'unknown';
  if (terminal.length === 1) {
    return terminal[0].status === EOnChainHistoryTxStatus.Failed ||
      terminal[0].candidate.isCancel
      ? 'failed'
      : 'success';
  }
  if (maxAttempts === 1) return 'unknown';
  const last = candidates[candidates.length - 1];
  const status = await check(last, maxAttempts);
  if (signal.aborted) return 'unknown';
  if (status === EOnChainHistoryTxStatus.Failed) return 'failed';
  if (status === EOnChainHistoryTxStatus.Success)
    return last.isCancel ? 'failed' : 'success';
  return 'unknown';
}
