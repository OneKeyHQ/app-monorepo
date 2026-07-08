import { useEffect, useMemo, useState } from 'react';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import PreSwapConfirmResult from '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
// broadcast. It subscribes to the tx receipt observer and drives the swap Review
// Order result component (PreSwapConfirmResult) — the same dynamic pending /
// success / failed animation the swap review sheet uses — so DeFi actions
// (withdraw / repay / remove / claim) get an identical confirming experience.
function DeFiActionTxConfirmResult({
  networkId,
  txid,
  finalStatusPromise,
  onDone,
}: {
  networkId: string;
  txid: string;
  finalStatusPromise: Promise<IDeFiActionTxConfirmDialogResult>;
  onDone: () => void;
}) {
  const [stepStatus, setStepStatus] = useState<ESwapStepStatus>(
    ESwapStepStatus.PENDING,
  );
  const [finalStatus, setFinalStatus] =
    useState<IDeFiActionTxConfirmDialogResult>();

  useEffect(() => {
    let mounted = true;
    void finalStatusPromise.then((result) => {
      if (!mounted) {
        return;
      }
      if (result === EOnChainHistoryTxStatus.Success) {
        setFinalStatus(result);
        setStepStatus(ESwapStepStatus.SUCCESS);
      } else if (result === EOnChainHistoryTxStatus.Failed) {
        setFinalStatus(result);
        setStepStatus(ESwapStepStatus.FAILED);
      }
      // Poll exhausted (undefined): keep it PENDING. PreSwapConfirmResult's
      // pending state already reads as "submitted — check history", which is the
      // truth for a broadcast-but-not-yet-final tx.
    });
    return () => {
      mounted = false;
    };
  }, [finalStatusPromise]);

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
      confirmButtonTextId={
        finalStatus === EOnChainHistoryTxStatus.Failed
          ? ETranslations.global_done
          : undefined
      }
      onConfirm={onDone}
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
// the receipt observer reaches a final state, or when the user dismisses the
// pending sheet. Resolves immediately when there's no account or no txid, so
// callers can `await` it unconditionally before running their refresh.
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
  const finalStatusPromise = waitForTxFinalStatus({
    accountId,
    networkId,
    txid,
  }).catch(() => undefined);
  let latestResult: IDeFiActionTxConfirmDialogResult;
  let uiSettled = false;
  let dismissedBeforeFinal = false;
  let resolveUiResult:
    | ((result: IDeFiActionTxConfirmDialogResult) => void)
    | undefined;
  const uiResultPromise = new Promise<IDeFiActionTxConfirmDialogResult>(
    (resolve) => {
      resolveUiResult = resolve;
    },
  );
  const finish = ({
    result,
    source,
  }: {
    result: IDeFiActionTxConfirmDialogResult;
    source: 'status' | 'user';
  }) => {
    if (uiSettled) {
      return;
    }
    uiSettled = true;
    dismissedBeforeFinal =
      source === 'user' && result === undefined && latestResult === undefined;
    resolveUiResult?.(result);
  };
  void finalStatusPromise.then((result) => {
    latestResult = result;
    if (!uiSettled) {
      finish({ result, source: 'status' });
      return;
    }
    if (dismissedBeforeFinal && result === EOnChainHistoryTxStatus.Success) {
      void backgroundApiProxy.serviceDeFi.refreshAccountDeFiPositionsAfterAction(
        {
          accountId,
          networkId,
        },
      );
    }
  });
  const dialogRef: { current?: ReturnType<typeof Dialog.show> } = {};
  const closeDialog = () => {
    finish({ result: latestResult, source: 'user' });
    void dialogRef.current?.close();
  };
  dialogRef.current = Dialog.show({
    showFooter: false,
    onClose: () => finish({ result: latestResult, source: 'user' }),
    renderContent: (
      <DeFiActionTxConfirmResult
        networkId={networkId}
        txid={txid}
        finalStatusPromise={finalStatusPromise}
        onDone={closeDialog}
      />
    ),
  });
  return uiResultPromise;
}
