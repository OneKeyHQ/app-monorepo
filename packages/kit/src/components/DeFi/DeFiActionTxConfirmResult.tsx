import { useEffect, useMemo, useState } from 'react';

import { Dialog } from '@onekeyhq/components';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import PreSwapConfirmResult from '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { ISwapStep, ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapStepStatus,
  ESwapStepType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

// A shared "confirming → result" sheet shown after a DeFi action tx is
// broadcast. It polls the tx receipt (waitForTxFinalStatus) and drives the swap
// Review Order result component (PreSwapConfirmResult) — the same dynamic
// pending / success / failed animation the swap review sheet uses — so DeFi
// actions (withdraw / repay / remove / claim) get an identical confirming
// experience. `onDone` is what closes the dialog (and lets the caller run its
// position refresh).
function DeFiActionTxConfirmResult({
  accountId,
  networkId,
  txid,
  onDone,
}: {
  accountId: string;
  networkId: string;
  txid: string;
  onDone: () => void;
}) {
  const [stepStatus, setStepStatus] = useState<ESwapStepStatus>(
    ESwapStepStatus.PENDING,
  );

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
        setStepStatus(ESwapStepStatus.SUCCESS);
      } else if (result === EOnChainHistoryTxStatus.Failed) {
        setStepStatus(ESwapStepStatus.FAILED);
      }
      // Poll exhausted (undefined): keep it PENDING. PreSwapConfirmResult's
      // pending state already reads as "submitted — check history", which is the
      // truth for a broadcast-but-not-yet-final tx.
    })();
    return () => controller.abort();
  }, [accountId, networkId, txid]);

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
      onConfirm={onDone}
    />
  );
}

function getLastSignedTxid(
  data: ISendTxOnSuccessData[] | undefined,
): string | undefined {
  if (!Array.isArray(data)) {
    return undefined;
  }
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const txid = data[i]?.signedTx?.txid;
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
}): Promise<void> {
  const txid = getLastSignedTxid(data);
  if (!accountId || !txid) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const dialog = Dialog.show({
      showFooter: false,
      onClose: finish,
      renderContent: (
        <DeFiActionTxConfirmResult
          accountId={accountId}
          networkId={networkId}
          txid={txid}
          onDone={() => {
            void dialog.close();
          }}
        />
      ),
    });
  });
}
