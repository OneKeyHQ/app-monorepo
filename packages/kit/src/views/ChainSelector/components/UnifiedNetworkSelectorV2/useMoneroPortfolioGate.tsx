import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText, YStack } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

type IMoneroGateAccount = {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  activeNetworkId: string | undefined;
};

async function resolveMoneroAccountId(
  { accountId, indexedAccountId, activeNetworkId }: IMoneroGateAccount,
  networkId: string,
) {
  if (!indexedAccountId) {
    return activeNetworkId === networkId ? accountId : undefined;
  }
  const deriveType =
    await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId,
    });
  // Resolve the target identity without creating any of the draft's accounts.
  return backgroundApiProxy.serviceAccount.getDbAccountIdFromIndexedAccountId({
    indexedAccountId,
    networkId,
    deriveType,
  });
}

async function readMoneroAvailability(
  params: { networkId: string; accountId: string },
  isCurrentOwner: () => boolean,
): Promise<
  { enabled: boolean; unavailableDescription?: ETranslations } | undefined
> {
  const support =
    await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountSupport(
      params,
    );
  if (!isCurrentOwner()) return undefined;
  if (support !== 'supported') {
    return {
      enabled: false,
      unavailableDescription:
        support === 'tempWallet'
          ? ETranslations.privacy_temp_wallet_unavailable__desc
          : ETranslations.privacy_balance_wallet_not_supported__desc,
    };
  }
  const state =
    await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
      params,
    );
  if (!isCurrentOwner()) return undefined;
  return state.privacyDisabled
    ? {
        enabled: false,
        unavailableDescription: ETranslations.global_not_available,
      }
    : { enabled: state.enabled || state.paused };
}

function MoneroPortfolioPromptContent({
  networkName,
  unavailableDescription,
}: {
  networkName: string;
  unavailableDescription: ETranslations | undefined;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$2">
      <SizableText size="$bodyLgMedium">{networkName}</SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id:
            unavailableDescription ??
            ETranslations.privacy_enable_account__desc,
        })}
      </SizableText>
    </YStack>
  );
}

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

  const showPrompt = useCallback(
    (
      network: IServerNetwork,
      unavailableDescription: ETranslations | undefined,
      isCurrentOwner: () => boolean,
    ) => {
      const canOpenNetwork = !unavailableDescription;
      const dialog = Dialog.show({
        title: intl.formatMessage({
          id: unavailableDescription
            ? ETranslations.global_not_available
            : ETranslations.privacy_enable_account__title,
        }),
        renderContent: (
          <MoneroPortfolioPromptContent
            networkName={network.name}
            unavailableDescription={unavailableDescription}
          />
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
    },
    [intl, onBeforeOpenNetwork, onOpenNetwork],
  );

  return useCallback(
    async (network: IServerNetwork): Promise<boolean> => {
      const isCurrentOwner = () => owner.mounted && ownerRef.current === owner;
      if (!isCurrentOwner() || owner.checking || dialogRef.current?.isExist()) {
        return true;
      }
      owner.checking = true;
      try {
        const moneroAccountId = await resolveMoneroAccountId(owner, network.id);
        if (!isCurrentOwner()) return true;
        if (!moneroAccountId) {
          throw new OneKeyLocalError('Monero account identity is unavailable');
        }
        const availability = await readMoneroAvailability(
          { networkId: network.id, accountId: moneroAccountId },
          isCurrentOwner,
        );
        if (!availability || !isCurrentOwner()) return true;
        if (availability.enabled) return false;
        showPrompt(
          network,
          availability.unavailableDescription,
          isCurrentOwner,
        );
        return true;
      } finally {
        owner.checking = false;
      }
    },
    [owner, showPrompt],
  );
}
