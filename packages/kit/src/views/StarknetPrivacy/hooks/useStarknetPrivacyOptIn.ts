import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  TransactionConfirmationPendingError,
  requestTxConfirmation,
  waitForSendPrerequisite,
  waitForTransactionReady,
} from '@onekeyhq/kit/src/hooks/transactionConfirmationUtils';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  ETranslations,
  ETranslationsMock,
} from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  STRK20_LOCAL_ERRORS,
  mapStrk20Error,
} from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import {
  EStrk20ErrorCode,
  EStrk20ErrorRetry,
  EStrk20SequencingStatus,
  type IStrk20ErrorMapping,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { formatMockMessage } from '../utils/starknetPrivacyUtils';

/**
 * Consent is persisted before the register tx is built on purpose: a failed
 * register must not lose the user's opt-in intent.
 */
export function useStarknetPrivacyOptIn({
  networkId,
  accountId,
  isResuming = false,
  onRegisterSubmitted,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  isResuming?: boolean;
  onRegisterSubmitted?: () => void;
}) {
  const intl = useIntl();
  const { navigationToTxConfirm } = useSignatureConfirm({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });
  const [isOptingIn, setIsOptingIn] = useState(false);
  const inFlight = useRef(false);
  const requestIdRef = useRef(0);
  const currentScope = useRef({ networkId, accountId });
  currentScope.current = { networkId, accountId };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [errorKey, setErrorKey] = useState<
    ETranslations | ETranslationsMock | undefined
  >();
  const [errorValues, setErrorValues] = useState<
    Record<string, string | number> | undefined
  >();
  // No retry action reads this until a failed attempt sets it, so `No` (hide
  // the retry) is the safe default rather than `Yes`.
  const [retryable, setRetryable] = useState<EStrk20ErrorRetry>(
    EStrk20ErrorRetry.No,
  );
  useEffect(() => {
    requestIdRef.current += 1;
    inFlight.current = false;
    setIsOptingIn(false);
    setErrorKey(undefined);
    setErrorValues(undefined);
    setRetryable(EStrk20ErrorRetry.No);
  }, [networkId, accountId]);

  const optIn = useCallback(async () => {
    if (!networkId || !accountId || inFlight.current) {
      return;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const isCurrent = () =>
      mounted.current &&
      requestIdRef.current === requestId &&
      currentScope.current.networkId === networkId &&
      currentScope.current.accountId === accountId;
    inFlight.current = true;
    setIsOptingIn(true);
    setErrorKey(undefined);
    setErrorValues(undefined);
    setRetryable(EStrk20ErrorRetry.No);
    let stage = 'recordConsent';
    try {
      let hasDeploymentStep = false;
      await backgroundApiProxy.serviceStarknetPrivacy.recordConsent({
        networkId,
        accountId,
        consentAcceptedAt: Date.now(),
      });
      if (!isCurrent()) return;
      if (!isResuming) {
        stage = 'prepareActivation';
        const activationTx =
          await backgroundApiProxy.serviceStarknetPrivacy.prepareAccountActivation(
            { networkId, accountId },
          );
        if (!isCurrent()) return;
        if (activationTx) {
          hasDeploymentStep = true;
          stage = 'confirmActivation';
          const result = await requestTxConfirmation(
            (callbacks) =>
              navigationToTxConfirm({
                unsignedTxs: [activationTx],
                isNavigationCurrent: isCurrent,
                transactionStep: { step: 1, total: 2 },
                ...callbacks,
                onConfirmationFail: () => {},
              }),
            isCurrent,
          );
          const txid = result?.[0]?.signedTx.txid;
          if (!txid || !isCurrent()) {
            onRegisterSubmitted?.();
            return;
          }
          onRegisterSubmitted?.();
          stage = 'waitActivation';
          if (
            !(await waitForSendPrerequisite({
              accountId,
              networkId,
              txid,
              isCurrent,
            }))
          )
            return;
          stage = 'waitSequencing';
          if (
            !(await waitForTransactionReady({
              isCurrent,
              check: async () => {
                const sequencing =
                  await backgroundApiProxy.serviceStarknetPrivacy.getSequencingState(
                    { accountId, networkId },
                  );
                return sequencing.status === EStrk20SequencingStatus.Ready;
              },
            }))
          )
            return;
        }
      }
      if (!isCurrent()) return;
      stage = 'buildRegister';
      const built =
        await backgroundApiProxy.serviceStarknetPrivacy.buildRegisterTx({
          networkId,
          accountId,
          resumeOnly: isResuming,
        });
      if (!isCurrent()) return;
      // The pool already holds this account's key: nothing to sign.
      if (built.alreadyRegistered) {
        onRegisterSubmitted?.();
        return;
      }
      stage = 'confirmRegister';
      await navigationToTxConfirm({
        unsignedTxs: [built.unsignedTx],
        ...(hasDeploymentStep
          ? { transactionStep: { step: 2, total: 2 } }
          : {}),
        isNavigationCurrent: isCurrent,
        onSuccess: (_data: ISendTxOnSuccessData[]) => {
          onRegisterSubmitted?.();
        },
        onCancel: () => onRegisterSubmitted?.(),
        onConfirmationFail: (error: Error) => {
          if (!isCurrent()) return;
          const mapped = mapStrk20Error(error);
          setErrorKey(mapped.translationKey);
          setErrorValues(mapped.translationValues);
          setRetryable(mapped.retryable);
          onRegisterSubmitted?.();
        },
      });
    } catch (error) {
      if (!isCurrent()) return;
      // closing the password prompt is the user's choice, not a failure
      if (
        errorUtils.isErrorByClassName({
          error,
          className: [EOneKeyErrorClassNames.PasswordPromptDialogCancel],
        })
      ) {
        return;
      }
      const mapped: IStrk20ErrorMapping =
        error instanceof TransactionConfirmationPendingError
          ? STRK20_LOCAL_ERRORS[EStrk20ErrorCode.Waiting]
          : mapStrk20Error(error);
      // Log only sanitized stage and mapped error code; never log raw proving errors.
      defaultLogger.app.error.log(
        `starknetPrivacy.optIn failed at stage=${stage} code=${mapped.code}`,
      );
      // Proof authorization may already be signed. Keep a deliberate retry
      // for unclassified failures; known-permanent failures hide it.
      const isUnclassified = mapped.code === EStrk20ErrorCode.Unknown;
      setErrorKey(mapped.translationKey);
      setErrorValues(mapped.translationValues);
      setRetryable(isUnclassified ? EStrk20ErrorRetry.Yes : mapped.retryable);
      onRegisterSubmitted?.();
      // Never log the original error: proving failures may carry a viewing key.
      Toast.error({
        title: formatMockMessage(
          intl,
          mapped.translationKey,
          mapped.translationValues,
        ),
      });
    } finally {
      if (requestIdRef.current === requestId) {
        inFlight.current = false;
        if (mounted.current) {
          setIsOptingIn(false);
        }
      }
    }
  }, [
    accountId,
    intl,
    isResuming,
    navigationToTxConfirm,
    networkId,
    onRegisterSubmitted,
  ]);

  return {
    optIn,
    isOptingIn,
    optInErrorKey: errorKey,
    optInErrorValues: errorValues,
    // Whether the same optIn() call is worth letting the user retry, per the
    // last failure. Callers should hide/disable the retry action otherwise.
    optInRetryable: errorKey ? retryable : undefined,
  };
}
