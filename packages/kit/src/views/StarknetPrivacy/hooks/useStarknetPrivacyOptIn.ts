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
import {
  STRK20_LOCAL_ERRORS,
  mapStrk20Error,
} from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import {
  EStrk20ErrorCode,
  EStrk20ErrorRetry,
  EStrk20SequencingStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20PrivacyNetworkConfig } from '@onekeyhq/shared/types/starknetPrivacy';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { showStarknetPrivacyConsentDialog } from '../components/showStarknetPrivacyConsentDialog';
import { formatMockMessage } from '../utils/starknetPrivacyUtils';

/**
 * Consent is persisted before the register tx is built on purpose: a failed
 * register must not restart the consent flow (plan section 4.2).
 */
export function useStarknetPrivacyOptIn({
  networkId,
  accountId,
  config,
  isResuming = false,
  hasConsent = false,
  onRegisterSubmitted,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  config?: IStrk20PrivacyNetworkConfig;
  isResuming?: boolean;
  hasConsent?: boolean;
  onRegisterSubmitted?: () => void;
}) {
  const intl = useIntl();
  const { navigationToTxConfirm } = useSignatureConfirm({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });
  const [isOptingIn, setIsOptingIn] = useState(false);
  const [optInPhase, setOptInPhase] = useState<
    'authorize' | 'proving' | 'review'
  >('authorize');
  const inFlight = useRef(false);
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
  // No retry action reads this until a failed attempt sets it, so `No` (hide
  // the retry) is the safe default rather than `Yes`.
  const [retryable, setRetryable] = useState<EStrk20ErrorRetry>(
    EStrk20ErrorRetry.No,
  );

  const optIn = useCallback(async () => {
    if (!networkId || !accountId || inFlight.current) {
      return;
    }
    const isCurrent = () =>
      mounted.current &&
      currentScope.current.networkId === networkId &&
      currentScope.current.accountId === accountId;
    inFlight.current = true;
    setIsOptingIn(true);
    setOptInPhase('authorize');
    setErrorKey(undefined);
    setRetryable(EStrk20ErrorRetry.No);
    try {
      let hasDeploymentStep = false;
      const protocolFee =
        isResuming || hasConsent
          ? undefined
          : await backgroundApiProxy.serviceStarknetPrivacy
              .getProtocolFee({ networkId })
              .catch(() => undefined);
      const confirmed =
        hasConsent && !isResuming
          ? true
          : await showStarknetPrivacyConsentDialog({
              intl,
              config,
              protocolFee,
              isResuming,
            });
      if (!confirmed || !isCurrent()) {
        return;
      }
      await backgroundApiProxy.serviceStarknetPrivacy.recordConsent({
        networkId,
        accountId,
        consentAcceptedAt: Date.now(),
      });
      if (!isResuming) {
        const activationTx =
          await backgroundApiProxy.serviceStarknetPrivacy.prepareAccountActivation(
            { networkId, accountId },
          );
        if (!isCurrent()) return;
        if (activationTx) {
          setOptInPhase('review');
          hasDeploymentStep = true;
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
          if (
            !(await waitForSendPrerequisite({
              accountId,
              networkId,
              txid,
              isCurrent,
            }))
          )
            return;
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
      if (!isResuming) setOptInPhase('proving');
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
      setOptInPhase('review');
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
        onFail: (error: Error) => {
          const mapped = mapStrk20Error(error);
          setErrorKey(mapped.translationKey);
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
      const mapped =
        error instanceof TransactionConfirmationPendingError
          ? STRK20_LOCAL_ERRORS[EStrk20ErrorCode.Waiting]
          : mapStrk20Error(error);
      // Proof authorization may already be signed. Keep a deliberate retry
      // for unclassified failures; known-permanent failures hide it.
      const isUnclassified = mapped.code === EStrk20ErrorCode.Unknown;
      setErrorKey(mapped.translationKey);
      setRetryable(isUnclassified ? EStrk20ErrorRetry.Yes : mapped.retryable);
      onRegisterSubmitted?.();
      // Never log the original error: proving failures may carry a viewing key.
      Toast.error({ title: formatMockMessage(intl, mapped.translationKey) });
    } finally {
      inFlight.current = false;
      setIsOptingIn(false);
    }
  }, [
    accountId,
    config,
    intl,
    isResuming,
    hasConsent,
    navigationToTxConfirm,
    networkId,
    onRegisterSubmitted,
  ]);

  return {
    optIn,
    isOptingIn,
    optInPhase,
    optInErrorKey: errorKey,
    // Whether the same optIn() call is worth letting the user retry, per the
    // last failure. Callers should hide/disable the retry action otherwise.
    optInRetryable: errorKey ? retryable : undefined,
  };
}
