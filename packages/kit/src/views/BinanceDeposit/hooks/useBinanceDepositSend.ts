import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IBinanceDepositSessionSnapshot } from '@onekeyhq/shared/types/exchange';

import { useSignatureConfirm } from '../../../hooks/useSignatureConfirm';
import { runBinanceDepositSendFlow } from '../sendFlow';

import type {
  IBinanceDepositSendNotice,
  IBinanceDepositSendResultLog,
} from '../sendFlow';

// React state around runBinanceDepositSendFlow: one run at a time, the amount
// typed for the session, the notice shown under the Send button, and which
// sessions this page instance already saw a successful submit for.
export function useBinanceDepositSend({
  session,
  requiresAddressTag,
  depositDust,
  isAssetListReady,
  isSignOnlyEnabled,
  refreshState,
  logSendResult,
}: {
  session?: IBinanceDepositSessionSnapshot;
  requiresAddressTag?: boolean;
  depositDust?: string;
  // The asset list is loaded and carries the asset of the session.
  isAssetListReady: boolean;
  isSignOnlyEnabled: boolean;
  refreshState: () => Promise<unknown>;
  logSendResult: (params: IBinanceDepositSendResultLog) => void;
}) {
  const intl = useIntl();
  // The transfer is always built for the account and network the session was
  // created with, whatever is selected on the page now.
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: session?.accountId ?? '',
    networkId: session?.networkId ?? '',
  });

  const activeLocalId = session?.localId;
  const [isPreparing, setIsPreparing] = useState(false);
  // Kept with the session it was typed for: a new session, possibly for
  // another asset, starts with an empty input instead of the last amount.
  const [amountState, setAmountState] = useState<
    { localId: string | undefined; value: string } | undefined
  >();
  const setAmount = useCallback(
    (value: string) => {
      setAmountState({ localId: activeLocalId, value });
    },
    [activeLocalId],
  );
  // Kept with the session it is about, so the notice of an earlier session
  // is not shown under a new one.
  const [noticeState, setNoticeState] = useState<
    { localId: string; notice: IBinanceDepositSendNotice } | undefined
  >();
  // Closes the gap until the report record shows up in the polled snapshot.
  const [sentLocalIds, setSentLocalIds] = useState<string[]>([]);
  const sentLocalIdsRef = useRef<Set<string>>(new Set());
  const preparingRef = useRef(false);
  const signOnlyRef = useRef(isSignOnlyEnabled);

  useEffect(() => {
    signOnlyRef.current = isSignOnlyEnabled;
  }, [isSignOnlyEnabled]);

  const reviewAndSend = useCallback(
    async (amountInput: string) => {
      if (!session || preparingRef.current) {
        return;
      }
      const { localId } = session;
      preparingRef.current = true;
      setIsPreparing(true);
      setNoticeState(undefined);
      try {
        await runBinanceDepositSendFlow({
          session,
          amountInput,
          requiresAddressTag,
          depositDust,
          isAssetListReady,
          isSignOnlyEnabled,
          isSignOnlyEnabledNow: () => signOnlyRef.current,
          hasSentLocally: sentLocalIdsRef.current.has(localId),
          intl,
          navigationToTxConfirm,
          onSent: (sentLocalId) => {
            sentLocalIdsRef.current.add(sentLocalId);
            setSentLocalIds([...sentLocalIdsRef.current]);
          },
          setNotice: (notice) => {
            setNoticeState({ localId, notice });
          },
          logSendResult,
          refreshState,
        });
      } finally {
        preparingRef.current = false;
        setIsPreparing(false);
      }
    },
    [
      depositDust,
      intl,
      isAssetListReady,
      isSignOnlyEnabled,
      logSendResult,
      navigationToTxConfirm,
      refreshState,
      requiresAddressTag,
      session,
    ],
  );

  return {
    isPreparing,
    amount:
      amountState && amountState.localId === activeLocalId
        ? amountState.value
        : '',
    setAmount,
    notice:
      noticeState && noticeState.localId === session?.localId
        ? noticeState.notice
        : undefined,
    hasSentLocally: session ? sentLocalIds.includes(session.localId) : false,
    reviewAndSend,
  };
}
