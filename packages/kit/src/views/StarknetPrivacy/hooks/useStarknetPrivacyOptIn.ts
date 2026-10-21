import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import { EStrk20ErrorRetry } from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20PrivacyNetworkConfig } from '@onekeyhq/shared/types/starknetPrivacy';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { showStarknetPrivacyConsentDialog } from '../components/showStarknetPrivacyConsentDialog';

/**
 * Consent is persisted before the register tx is built on purpose: a failed
 * register must not restart the consent flow (plan section 4.2).
 */
export function useStarknetPrivacyOptIn({
  networkId,
  accountId,
  config,
  onRegisterSubmitted,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  config?: IStrk20PrivacyNetworkConfig;
  onRegisterSubmitted?: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [isOptingIn, setIsOptingIn] = useState(false);
  const [errorKey, setErrorKey] = useState<
    ETranslations | ETranslationsMock | undefined
  >();
  // No retry action reads this until a failed attempt sets it, so `No` (hide
  // the retry) is the safe default rather than `Yes`.
  const [retryable, setRetryable] = useState<EStrk20ErrorRetry>(
    EStrk20ErrorRetry.No,
  );

  const optIn = useCallback(async () => {
    if (!networkId || !accountId || isOptingIn) {
      return;
    }
    const protocolFee = await backgroundApiProxy.serviceStarknetPrivacy
      .getProtocolFee({ networkId })
      .catch(() => undefined);
    const confirmed = await showStarknetPrivacyConsentDialog({
      intl,
      config,
      protocolFee,
    });
    if (!confirmed) {
      return;
    }
    setErrorKey(undefined);
    setRetryable(EStrk20ErrorRetry.No);
    setIsOptingIn(true);
    try {
      await backgroundApiProxy.serviceStarknetPrivacy.recordConsent({
        networkId,
        accountId,
        consentAcceptedAt: Date.now(),
      });
      const unsignedTx =
        await backgroundApiProxy.serviceStarknetPrivacy.buildRegisterTx({
          networkId,
          accountId,
        });
      navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
        screen: EModalSignatureConfirmRoutes.TxConfirm,
        params: {
          networkId,
          accountId,
          unsignedTxs: [unsignedTx],
          onSuccess: (_data: ISendTxOnSuccessData[]) => {
            onRegisterSubmitted?.();
          },
        },
      });
    } catch (error) {
      // closing the password prompt is the user's choice, not a failure
      if (
        errorUtils.isErrorByClassName({
          error,
          className: [EOneKeyErrorClassNames.PasswordPromptDialogCancel],
        })
      ) {
        return;
      }
      console.error('starknet privacy opt-in failed', error);
      const mapped = mapStrk20Error(error);
      // Nothing is signed before the confirm page, so an unclassified failure
      // keeps the retry; only a known-permanent one hides it.
      const isUnclassified =
        mapped.translationKey ===
        ETranslationsMock.starknet_privacy_error_unknown;
      setErrorKey(mapped.translationKey);
      setRetryable(isUnclassified ? EStrk20ErrorRetry.Yes : mapped.retryable);
    } finally {
      setIsOptingIn(false);
    }
  }, [
    accountId,
    config,
    intl,
    isOptingIn,
    navigation,
    networkId,
    onRegisterSubmitted,
  ]);

  return {
    optIn,
    isOptingIn,
    optInErrorKey: errorKey,
    // Whether the same optIn() call is worth letting the user retry, per the
    // last failure. Callers should hide/disable the retry action otherwise.
    optInRetryable: errorKey ? retryable : undefined,
  };
}
