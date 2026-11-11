import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText, YStack } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export function useMoneroPortfolioGate({
  walletId,
  accountId,
  indexedAccountId,
  activeNetworkId,
  onOpenNetwork,
  onBeforeOpenNetwork,
}: {
  walletId: string;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  activeNetworkId: string | undefined;
  onOpenNetwork: (network: IServerNetwork) => Promise<void>;
  onBeforeOpenNetwork: () => void;
}) {
  const intl = useIntl();
  const owner = useMemo(
    () => ({
      mounted: true,
      checking: false,
      walletId,
      accountId,
      indexedAccountId,
      activeNetworkId,
    }),
    [walletId, accountId, indexedAccountId, activeNetworkId],
  );
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const dialogRef = useRef<IDialogInstance | undefined>(undefined);

  useEffect(() => {
    owner.mounted = true;
    return () => {
      owner.mounted = false;
      const dialog = dialogRef.current;
      dialogRef.current = undefined;
      void dialog?.close();
    };
  }, [owner]);

  return useCallback(
    async (network: IServerNetwork): Promise<boolean> => {
      const isCurrentOwner = () => owner.mounted && ownerRef.current === owner;
      if (!isCurrentOwner() || owner.checking || dialogRef.current?.isExist()) {
        return true;
      }
      owner.checking = true;
      try {
        let moneroAccountId =
          activeNetworkId === network.id ? accountId : undefined;
        if (indexedAccountId) {
          const deriveType =
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              {
                networkId: network.id,
              },
            );
          // Resolve the target identity without creating any of the draft's accounts.
          moneroAccountId =
            await backgroundApiProxy.serviceAccount.getDbAccountIdFromIndexedAccountId(
              {
                indexedAccountId,
                networkId: network.id,
                deriveType,
              },
            );
        }
        if (!isCurrentOwner()) return true;
        if (!moneroAccountId) {
          throw new OneKeyLocalError('Monero account identity is unavailable');
        }
        const params = { networkId: network.id, accountId: moneroAccountId };
        const support =
          await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountSupport(
            params,
          );
        if (!isCurrentOwner()) return true;
        let unavailableDescription: ETranslations | undefined;
        if (support === 'tempWallet') {
          unavailableDescription =
            ETranslations.privacy_temp_wallet_unavailable__desc;
        } else if (support !== 'supported') {
          unavailableDescription =
            ETranslations.privacy_balance_wallet_not_supported__desc;
        } else {
          const state =
            await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
              params,
            );
          if (!isCurrentOwner()) return true;
          if (state.privacyDisabled) {
            unavailableDescription = ETranslations.global_not_available;
          } else if (state.enabled || state.paused) {
            return false;
          }
        }

        const canOpenNetwork = !unavailableDescription;
        const dialog = Dialog.show({
          title: intl.formatMessage({
            id: unavailableDescription
              ? ETranslations.global_not_available
              : ETranslations.privacy_enable_account__title,
          }),
          renderContent: (
            <YStack gap="$2">
              <SizableText size="$bodyLgMedium">{network.name}</SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id:
                    unavailableDescription ??
                    ETranslations.privacy_enable_account__desc,
                })}
              </SizableText>
            </YStack>
          ),
          showCancelButton: canOpenNetwork,
          onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
          onConfirmText: intl.formatMessage({
            id: canOpenNetwork
              ? ETranslations.global_go_to
              : ETranslations.global_got_it,
          }),
          onConfirm: async ({ close }) => {
            if (!isCurrentOwner()) return;
            await close();
            if (canOpenNetwork && isCurrentOwner()) {
              onBeforeOpenNetwork();
              await onOpenNetwork(network);
            }
          },
          onClose: () => {
            if (dialogRef.current === dialog) dialogRef.current = undefined;
          },
        });
        dialogRef.current = dialog;
        return true;
      } finally {
        owner.checking = false;
      }
    },
    [
      accountId,
      activeNetworkId,
      indexedAccountId,
      intl,
      onBeforeOpenNetwork,
      onOpenNetwork,
      owner,
    ],
  );
}
