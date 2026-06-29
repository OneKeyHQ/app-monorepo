import { useEffect, useMemo, useState } from 'react';

import { Dialog } from '@onekeyhq/components';
import PreSwapConfirmResult from '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { ISwapStep, ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapStepStatus,
  ESwapStepType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { waitForTxFinalStatus } from '../../utils/waitForTxFinalStatus';

export type IDeFiActionTxConfirmDialogResult =
  | EOnChainHistoryTxStatus
  | undefined;

// A shared "confirming → result" sheet shown after a DeFi action tx is
// broadcast. It polls the tx receipt (waitForTxFinalStatus) and drives the swap
// Review Order result component (PreSwapConfirmResult) — the same dynamic
// pending / success / failed animation the swap review sheet uses — so DeFi
// actions (withdraw / repay / remove / claim) get an identical confirming
// experience. `onDone` closes the dialog and returns the final status to the
// caller so failed transactions do not trigger success-only refresh effects.
function DeFiActionTxConfirmResult({
  accountId,
  networkId,
  txid,
  onDone,
  onStatusChange,
}: {
  accountId: string;
  networkId: string;
  txid: string;
  onDone: (result: IDeFiActionTxConfirmDialogResult) => void;
  onStatusChange: (result: IDeFiActionTxConfirmDialogResult) => void;
}) {
  const [stepStatus, setStepStatus] = useState<ESwapStepStatus>(
    ESwapStepStatus.PENDING,
  );
  const [finalStatus, setFinalStatus] =
    useState<IDeFiActionTxConfirmDialogResult>();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const result = await waitForTxFinalStatus({
        accountId,
        networkId,
        txid,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      if (result === EOnChainHistoryTxStatus.Success) {
        setFinalStatus(result);
        onStatusChange(result);
        setStepStatus(ESwapStepStatus.SUCCESS);
      } else if (result === EOnChainHistoryTxStatus.Failed) {
        setFinalStatus(result);
        onStatusChange(result);
        setStepStatus(ESwapStepStatus.FAILED);
      }
      // Poll exhausted (undefined): keep it PENDING. PreSwapConfirmResult's
      // pending state already reads as "submitted — check history", which is the
      // truth for a broadcast-but-not-yet-final tx.
    })();
    return () => controller.abort();
  }, [accountId, networkId, onStatusChange, txid]);

  // PreSwapConfirmResult is fully prop-driven; it reads only status / txHash off
  // the step and networkId off fromToken (to build the explorer link). The
  // remaining ISwapStep / ISwapToken fields are required by the types but never
  // displayed, so they carry placeholder values.
  const lastStep = useMemo<ISwapStep>(
    () => ({
      type: ESwapStepType.SEND_TX,
      status: stepStatus,
      txHash: txid,
    }),
    [stepStatus, txid],
  );
  const fromToken = useMemo<ISwapToken>(
    () => ({
      networkId,
      contractAddress: '',
      symbol: '',
      decimals: 0,
    }),
    [networkId],
  );

  return (
    <PreSwapConfirmResult
      lastStep={lastStep}
      fromToken={fromToken}
      onConfirm={() => onDone(finalStatus)}
    />
  );
}

function getLastTxid(
  data: ISendTxOnSuccessData[] | undefined,
): string | undefined {
  if (!Array.isArray(data)) {
    return undefined;
  }
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const txid = data[i]?.signedTx?.txid || data[i]?.decodedTx?.txid;
    if (txid) {
      return txid;
    }
  }
  return undefined;
}

// Show the confirming sheet for the last broadcast tx in `data` and resolve once
// the user dismisses it (Done / close). Resolves immediately when there's no
// account or no txid, so callers can `await` it unconditionally before running
// their refresh.
export function showDeFiActionTxConfirmDialog({
  accountId,
  networkId,
  data,
}: {
  accountId?: string;
  networkId: string;
  data: ISendTxOnSuccessData[];
}): Promise<IDeFiActionTxConfirmDialogResult> {
  const txid = getLastTxid(data);
  if (!accountId || !txid) {
    return Promise.resolve(undefined);
  }
  return new Promise<IDeFiActionTxConfirmDialogResult>((resolve) => {
    let settled = false;
    let latestResult: IDeFiActionTxConfirmDialogResult;
    const finish = (result?: IDeFiActionTxConfirmDialogResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const dialog = Dialog.show({
      showFooter: false,
      onClose: () => finish(latestResult),
      renderContent: (
        <DeFiActionTxConfirmResult
          accountId={accountId}
          networkId={networkId}
          txid={txid}
          onStatusChange={(result) => {
            latestResult = result;
          }}
          onDone={(result) => {
            finish(result);
            void dialog.close();
          }}
        />
      ),
    });
  });
}
