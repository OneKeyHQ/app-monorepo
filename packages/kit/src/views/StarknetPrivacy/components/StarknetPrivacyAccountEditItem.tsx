import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import {
  isStrk20Mismatch,
  isStrk20RegisterPending,
  isStrk20Registered,
  useStarknetPrivacyAccountState,
  useStarknetPrivacyAvailability,
} from '../hooks/useStarknetPrivacy';
import { useStarknetPrivacyOptIn } from '../hooks/useStarknetPrivacyOptIn';
import { formatMockMessage } from '../utils/starknetPrivacyUtils';

/**
 * Opt-in entry for STRK20 private transfers. Renders nothing until the remote
 * config says the pool is live for this network, so an unavailable feature
 * never shows a dead menu row.
 */
export function StarknetPrivacyAccountEditItem({
  networkId,
  accountId,
  indexedAccountId,
  onClose,
}: {
  networkId?: string;
  accountId?: string;
  indexedAccountId?: string;
  onClose: () => void;
}) {
  const intl = useIntl();

  const { result: resolvedAccountId } = usePromiseResult(
    async () => {
      if (accountId) {
        return accountId;
      }
      if (!indexedAccountId || !networkId) {
        return undefined;
      }
      try {
        const deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });
        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: undefined,
            indexedAccountId,
            networkId,
            deriveType,
          });
        return account?.id;
      } catch {
        return undefined;
      }
    },
    [accountId, indexedAccountId, networkId],
    { initResult: undefined },
  );

  const { isAvailable, config } = useStarknetPrivacyAvailability({
    networkId,
    accountId: resolvedAccountId,
  });
  const { state, reload } = useStarknetPrivacyAccountState({
    networkId,
    accountId: resolvedAccountId,
    enabled: isAvailable,
  });

  const { optIn, isOptingIn } = useStarknetPrivacyOptIn({
    networkId,
    accountId: resolvedAccountId,
    config,
    onRegisterSubmitted: reload,
  });

  const registered = isStrk20Registered(state);
  const pending = isStrk20RegisterPending(state);
  const mismatch = isStrk20Mismatch(state);

  const handleOptOut = useCallback(() => {
    if (!networkId || !resolvedAccountId) {
      return;
    }
    Dialog.show({
      icon: 'ShieldKeyholeOutline',
      title: formatMockMessage(
        intl,
        ETranslationsMock.starknet_privacy_private_transfers,
      ),
      description: formatMockMessage(
        intl,
        ETranslationsMock.starknet_privacy_opt_out_note,
      ),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_confirm }),
      onConfirm: async () => {
        try {
          await backgroundApiProxy.serviceStarknetPrivacy.optOut({
            networkId,
            accountId: resolvedAccountId,
          });
          reload();
        } catch (error) {
          console.error('starknet privacy opt-out failed', error);
        }
      },
    });
  }, [intl, networkId, reload, resolvedAccountId]);

  const handlePress = useCallback(() => {
    if (registered) {
      handleOptOut();
      return;
    }
    void optIn();
  }, [handleOptOut, optIn, registered]);

  if (!isAvailable || !resolvedAccountId) {
    return null;
  }

  let descriptionKey = ETranslationsMock.starknet_privacy_status_off;
  if (mismatch) {
    descriptionKey = ETranslationsMock.starknet_privacy_status_mismatch;
  } else if (registered) {
    descriptionKey = ETranslationsMock.starknet_privacy_status_on;
  } else if (pending) {
    descriptionKey = ETranslationsMock.starknet_privacy_status_pending;
  }

  return (
    <ActionList.Item
      icon="ShieldKeyholeOutline"
      label={formatMockMessage(
        intl,
        ETranslationsMock.starknet_privacy_private_transfers,
      )}
      description={formatMockMessage(intl, descriptionKey)}
      descriptionNumberOfLines={2}
      // A key mismatch must never lead back into registration.
      disabled={mismatch || pending}
      isLoading={isOptingIn}
      onClose={onClose}
      onPress={handlePress}
    />
  );
}
