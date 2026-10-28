import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useRouteIsFocusedWhenEnabled } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

const LIQUID_USD = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
const OLD_ATOMIC_QUEUE = '0xd45884b592e316eb816199615a95c182f75dea07';

type IStatus =
  | 'checking'
  | 'clear'
  | 'required'
  | 'submitting'
  | 'pending'
  | 'unknown';

export function useEtherFiLegacyApproval({
  accountId,
  networkId,
  provider,
  vault,
  onCleared,
  skip,
}: {
  accountId: string;
  networkId: string;
  provider: string;
  vault?: string;
  onCleared?: () => void;
  skip?: boolean;
}) {
  const isEtherFi =
    !skip &&
    provider.toLowerCase() === 'etherfi' &&
    networkId === getNetworkIdsMap().eth;
  const applicable = isEtherFi && vault?.toLowerCase() === LIQUID_USD;
  const isFocused = useRouteIsFocusedWhenEnabled({ enabled: !!applicable });
  const scope = [
    accountId,
    networkId,
    provider.toLowerCase(),
    vault ?? '',
    skip,
  ].join('|');
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const generation = useRef(0);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const pendingTxIdRef = useRef<string | undefined>(undefined);
  const pendingIsCancelRef = useRef(false);
  const [state, setState] = useState<{ scope: string; status: IStatus }>({
    scope,
    status: 'checking',
  });
  const status = state.scope === scope ? state.status : 'checking';
  const statusRef = useRef(status);
  statusRef.current = status;
  const onClearedRef = useRef(onCleared);
  onClearedRef.current = onCleared;
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  const read = useCallback(async () => {
    const result = await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
      accountId,
      networkId,
      tokenAddress: LIQUID_USD,
      spenderAddress: OLD_ATOMIC_QUEUE,
    });
    const value = new BigNumber(result.allowanceParsed);
    if (!value.isFinite() || value.isNegative())
      throw new OneKeyLocalError('Invalid allowance');
    return value.isZero();
  }, [accountId, networkId]);

  const findPendingRevoke = useCallback(async () => {
    const accountAddress =
      await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });
    const transactions =
      await backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs({
        accountAddress,
        networkId,
      });
    const transaction = transactions.find(({ decodedTx }) => {
      const approval = decodedTx.approveInfo;
      if (
        approval?.spender?.toLowerCase() === OLD_ATOMIC_QUEUE &&
        approval.tokenInfo?.address.toLowerCase() === LIQUID_USD &&
        new BigNumber(approval.amount).isZero()
      )
        return true;
      return decodedTx.actions.some(
        ({ tokenApprove }) =>
          tokenApprove?.spender?.toLowerCase() === OLD_ATOMIC_QUEUE &&
          tokenApprove.tokenIdOnNetwork.toLowerCase() === LIQUID_USD &&
          new BigNumber(tokenApprove.amount).isZero(),
      );
    });
    return transaction
      ? {
          txid: transaction.decodedTx.txid,
          isCancel: transaction.replacedType === EReplaceTxType.Cancel,
        }
      : undefined;
  }, [accountId, networkId]);

  const findRevokeReplacement = useCallback(
    async (txid: string) => {
      const [accountAddress, xpub] = await Promise.all([
        backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
        backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
      ]);
      let historyId = accountUtils.buildLocalHistoryId({
        accountAddress,
        networkId,
        txid,
        xpub,
      });
      const visited = new Set<string>();
      let hasReplacement = false;

      while (historyId && !visited.has(historyId) && visited.size < 32) {
        visited.add(historyId);
        const transaction =
          await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
            accountId,
            networkId,
            historyId,
          });
        if (!transaction) return undefined;
        if (!transaction.replacedNextId) {
          return hasReplacement && transaction.decodedTx.txid
            ? {
                txid: transaction.decodedTx.txid,
                isCancel: transaction.replacedType === EReplaceTxType.Cancel,
              }
            : undefined;
        }
        hasReplacement = true;
        historyId = transaction.replacedNextId;
      }
      return undefined;
    },
    [accountId, networkId],
  );

  const monitorTx = useCallback(
    async (txid: string, id: number, controller: AbortController) => {
      const current = () =>
        id === generation.current &&
        scopeRef.current === scope &&
        !controller.signal.aborted;
      try {
        const finalStatus = await waitForTxFinalStatus({
          accountId,
          networkId,
          txid,
          signal: controller.signal,
        });
        if (!current()) return;
        if (finalStatus === EOnChainHistoryTxStatus.Failed) {
          pendingTxIdRef.current = undefined;
          setState({ scope, status: 'unknown' });
          return;
        }
        if (finalStatus !== EOnChainHistoryTxStatus.Success) return;
        if (pendingIsCancelRef.current) {
          const clear = await read();
          if (current()) {
            pendingTxIdRef.current = undefined;
            pendingIsCancelRef.current = false;
            setState({ scope, status: clear ? 'clear' : 'required' });
            if (clear) onClearedRef.current?.();
          }
          return;
        }
        for (let attempt = 0; attempt < 15 && current(); attempt += 1) {
          try {
            if (await read()) {
              if (current()) {
                pendingTxIdRef.current = undefined;
                setState({ scope, status: 'clear' });
                onClearedRef.current?.();
              }
              return;
            }
          } catch {
            /* Allowance reads can lag the transaction. */
          }
          await timerUtils.wait(2000);
        }
      } catch {
        if (current()) setState({ scope, status: 'pending' });
      }
    },
    [accountId, networkId, read, scope],
  );

  const refresh = useCallback(async () => {
    const wasPending = statusRef.current === 'pending';
    const previousTxId = pendingTxIdRef.current;
    if (!wasPending) generation.current += 1;
    const id = generation.current;
    setState({ scope, status: wasPending ? 'pending' : 'checking' });
    try {
      const clear = await read();
      if (id === generation.current && scopeRef.current === scope) {
        let nextStatus: IStatus = 'clear';
        if (!clear) {
          const pendingTx = await findPendingRevoke();
          if (id !== generation.current || scopeRef.current !== scope) return;
          const replacementTx =
            !pendingTx && wasPending && previousTxId
              ? await findRevokeReplacement(previousTxId)
              : undefined;
          if (id !== generation.current || scopeRef.current !== scope) return;
          const activeTx = pendingTx ?? replacementTx;
          if (activeTx) {
            pendingTxIdRef.current = activeTx.txid;
            pendingIsCancelRef.current = activeTx.isCancel;
          }
          if (activeTx || wasPending) {
            nextStatus = 'pending';
            const txid = pendingTxIdRef.current;
            if (txid) {
              const details =
                await backgroundApiProxy.serviceHistory.fetchTxDetails({
                  accountId,
                  networkId,
                  txid,
                });
              if (id !== generation.current || scopeRef.current !== scope)
                return;
              if (details?.data?.status === EOnChainHistoryTxStatus.Failed) {
                pendingTxIdRef.current = undefined;
                nextStatus = 'required';
              }
              if (
                details?.data?.status === EOnChainHistoryTxStatus.Success &&
                pendingIsCancelRef.current
              ) {
                pendingTxIdRef.current = undefined;
                pendingIsCancelRef.current = false;
                nextStatus = 'required';
              }
            }
          } else {
            nextStatus = 'required';
          }
        }
        setState({ scope, status: nextStatus });
        if (
          nextStatus === 'pending' &&
          pendingTxIdRef.current &&
          (!wasPending || pendingTxIdRef.current !== previousTxId)
        ) {
          abortRef.current?.abort();
          const controller = new AbortController();
          abortRef.current = controller;
          void monitorTx(pendingTxIdRef.current, id, controller);
        }
        if (nextStatus !== 'pending' && wasPending) {
          generation.current += 1;
          abortRef.current?.abort();
          pendingTxIdRef.current = undefined;
          pendingIsCancelRef.current = false;
          if (clear) onClearedRef.current?.();
        }
      }
    } catch {
      if (id === generation.current && scopeRef.current === scope) {
        setState({ scope, status: wasPending ? 'pending' : 'unknown' });
      }
    }
  }, [
    accountId,
    findPendingRevoke,
    findRevokeReplacement,
    monitorTx,
    networkId,
    read,
    scope,
  ]);

  useEffect(() => {
    return () => {
      generation.current += 1;
      abortRef.current?.abort();
      pendingTxIdRef.current = undefined;
      pendingIsCancelRef.current = false;
    };
  }, [scope]);

  useEffect(() => {
    if (
      applicable &&
      accountId &&
      isFocused &&
      statusRef.current !== 'pending' &&
      statusRef.current !== 'submitting'
    )
      void refresh();
  }, [accountId, applicable, isFocused, refresh]);

  const revoke = useCallback(async () => {
    if (!applicable || statusRef.current !== 'required') return;
    statusRef.current = 'submitting';
    generation.current += 1;
    const id = generation.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const current = () =>
      id === generation.current &&
      scopeRef.current === scope &&
      !controller.signal.aborted;
    setState({ scope, status: 'submitting' });
    try {
      if (await read()) {
        if (current()) {
          setState({ scope, status: 'clear' });
          onCleared?.();
        }
        return;
      }
      const pendingTx = await findPendingRevoke();
      if (!current()) return;
      if (pendingTx) {
        pendingTxIdRef.current = pendingTx.txid;
        pendingIsCancelRef.current = pendingTx.isCancel;
        setState({ scope, status: 'pending' });
        void monitorTx(pendingTx.txid, id, controller);
        return;
      }
      const [account, detail] = await Promise.all([
        backgroundApiProxy.serviceAccount.getAccount({ accountId, networkId }),
        backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
          networkId,
          tokenAddress: LIQUID_USD,
        }),
      ]);
      if (!current()) return;
      const token = detail?.info;
      if (
        !token ||
        token.address.toLowerCase() !== LIQUID_USD ||
        token.isNative
      )
        throw new OneKeyLocalError('Invalid liquidUSD token');
      await navigationToTxConfirm({
        approvesInfo: [
          {
            owner: account.address,
            spender: OLD_ATOMIC_QUEUE,
            amount: '0',
            isMax: false,
            tokenInfo: token,
          },
        ],
        onCancel: () => {
          if (current()) setState({ scope, status: 'required' });
        },
        onFail: () => {
          if (current()) setState({ scope, status: 'unknown' });
        },
        onSuccess: (data) => {
          if (!current()) return;
          setState({ scope, status: 'pending' });
          const txid = data[0]?.signedTx?.txid ?? data[0]?.decodedTx?.txid;
          if (!txid) return;
          pendingTxIdRef.current = txid;
          pendingIsCancelRef.current = false;
          void monitorTx(txid, id, controller);
        },
      });
    } catch {
      if (current()) setState({ scope, status: 'unknown' });
    }
  }, [
    accountId,
    applicable,
    findPendingRevoke,
    monitorTx,
    navigationToTxConfirm,
    networkId,
    onCleared,
    read,
    scope,
  ]);

  const verifyBeforeAction = useCallback(async () => {
    if (!isEtherFi || (vault && !applicable)) return true;
    if (!applicable || !accountId || statusRef.current !== 'clear')
      return false;
    generation.current += 1;
    const id = generation.current;
    setState({ scope, status: 'checking' });
    try {
      const clear = await read();
      if (id !== generation.current || scopeRef.current !== scope) return false;
      const pendingTx = clear ? undefined : await findPendingRevoke();
      if (id !== generation.current || scopeRef.current !== scope) return false;
      if (pendingTx) {
        pendingTxIdRef.current = pendingTx.txid;
        pendingIsCancelRef.current = pendingTx.isCancel;
        setState({ scope, status: 'pending' });
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        void monitorTx(pendingTx.txid, id, controller);
        return false;
      }
      if (!clear) {
        statusRef.current = 'required';
        setState({ scope, status: 'required' });
        await revoke();
        return false;
      }
      setState({ scope, status: 'clear' });
      return true;
    } catch {
      if (id === generation.current && scopeRef.current === scope)
        setState({ scope, status: 'unknown' });
      return false;
    }
  }, [
    accountId,
    applicable,
    findPendingRevoke,
    isEtherFi,
    monitorTx,
    read,
    revoke,
    scope,
    vault,
  ]);

  return {
    blocked: isEtherFi && (!vault || (applicable && status !== 'clear')),
    status: applicable ? status : undefined,
    refresh,
    revoke,
    verifyBeforeAction,
  };
}
