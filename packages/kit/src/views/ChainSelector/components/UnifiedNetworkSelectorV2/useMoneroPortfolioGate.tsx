import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText, YStack } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

type IMoneroGateAccount = {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  activeNetworkId: string | undefined;
};

type IMoneroAvailability = {
  enabled: boolean;
  unavailableDescription?: ETranslations;
};

export type IMoneroPortfolioOwnerGuard = (createdAccount?: {
  walletId: string | undefined;
  indexedAccountId: string | undefined;
}) => boolean;

type IMoneroPortfolioOwner = IMoneroGateAccount & {
  walletId: string;
  mounted: boolean;
  checking: boolean;
};

function createPortfolioOwnerGuard(
  owner: IMoneroPortfolioOwner,
  ownerRef: { current: IMoneroPortfolioOwner },
  firstIndexOwnerRef: { current: IMoneroPortfolioOwner | undefined },
): IMoneroPortfolioOwnerGuard {
  let createdIndex: string | undefined;
  return (createdAccount) => {
    const current = ownerRef.current;
    if (createdAccount && !owner.indexedAccountId) {
      if (
        createdAccount.walletId !== owner.walletId ||
        !createdAccount.indexedAccountId
      )
        return false;
      createdIndex = createdAccount.indexedAccountId;
    }
    if (current === owner) return owner.mounted;
    return Boolean(
      current.mounted &&
      firstIndexOwnerRef.current === owner &&
      createdIndex &&
      current.indexedAccountId === createdIndex,
    );
  };
}

async function readMoneroWalletAvailability(
  { walletId, networkId }: { walletId: string; networkId: string },
  isCurrentOwner: () => boolean,
): Promise<IMoneroAvailability | undefined> {
  const wallet = await backgroundApiProxy.serviceAccount.getWalletSafe({
    walletId,
    withoutRefill: true,
  });
  if (!isCurrentOwner()) return undefined;
  if (!wallet || !accountUtils.isHdWallet({ walletId: wallet.id })) {
    return {
      enabled: false,
      unavailableDescription:
        ETranslations.privacy_balance_wallet_not_supported__desc,
    };
  }
  if (wallet.isTemp) {
    return {
      enabled: false,
      unavailableDescription:
        ETranslations.privacy_temp_wallet_unavailable__desc,
    };
  }
  await backgroundApiProxy.serviceCustomRpc.ensureLocalWalletRemoteConfigLoaded();
  if (!isCurrentOwner()) return undefined;
  const networks =
    await backgroundApiProxy.servicePrivacyChain.getLocalWalletNetworkIds();
  if (!isCurrentOwner()) return undefined;
  return {
    enabled: false,
    unavailableDescription: networks.includes(networkId)
      ? undefined
      : ETranslations.global_not_available,
  };
}

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
): Promise<IMoneroAvailability | undefined> {
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
      {unavailableDescription ? (
        <SizableText size="$bodyLgMedium">{networkName}</SizableText>
      ) : null}
      <SizableText size="$bodyMd" color="$textSubdued">
        {unavailableDescription
          ? intl.formatMessage({ id: unavailableDescription })
          : intl.formatMessage({
              id: ETranslations.monero_enable_for_portfolio__desc,
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
  onSkipNetwork,
}: {
  walletId: string;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  activeNetworkId: string | undefined;
  onOpenNetwork: (network: IServerNetwork) => Promise<void>;
  onBeforeOpenNetwork: () => void;
  onSkipNetwork: (
    network: IServerNetwork,
    isCurrentOwner: IMoneroPortfolioOwnerGuard,
  ) => Promise<void>;
}) {
  const intl = useIntl();
  // Once an index exists, its identity owns every network account resolved under it.
  const ownerAccountId = indexedAccountId ? undefined : accountId;
  const owner = useMemo(
    () => ({
      mounted: true,
      checking: false,
      walletId,
      accountId: ownerAccountId,
      indexedAccountId,
      activeNetworkId,
    }),
    [walletId, ownerAccountId, indexedAccountId, activeNetworkId],
  );
  const ownerRef = useRef(owner);
  const firstIndexOwnerRef = useRef<typeof owner | undefined>(undefined);
  if (ownerRef.current !== owner) {
    const previous = ownerRef.current;
    firstIndexOwnerRef.current =
      previous.walletId === walletId &&
      previous.activeNetworkId === activeNetworkId &&
      !previous.indexedAccountId &&
      indexedAccountId
        ? previous
        : undefined;
  }
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
      isCurrentOwner: IMoneroPortfolioOwnerGuard,
    ) => {
      const canOpenNetwork = !unavailableDescription;
      let actionStarted = false;
      const dialog = Dialog.show({
        title: unavailableDescription
          ? intl.formatMessage({ id: ETranslations.global_not_available })
          : intl.formatMessage({
              id: ETranslations.monero_enable_for_portfolio__title,
            }),
        renderContent: (
          <MoneroPortfolioPromptContent
            networkName={network.name}
            unavailableDescription={unavailableDescription}
          />
        ),
        showCancelButton: canOpenNetwork,
        onCancelText: intl.formatMessage({
          id: ETranslations.monero_skip__action,
        }),
        onCancel: async (close) => {
          if (!canOpenNetwork || !isCurrentOwner() || actionStarted) return;
          actionStarted = true;
          await close();
          if (isCurrentOwner()) {
            // Match Done: hardware recovery errors need the global rejection handler.
            await onSkipNetwork(network, isCurrentOwner);
          }
        },
        onConfirmText: canOpenNetwork
          ? intl.formatMessage({
              id: ETranslations.privacy_go_to_enable__action,
            })
          : intl.formatMessage({ id: ETranslations.global_got_it }),
        onConfirm: async ({ close }) => {
          if (!isCurrentOwner() || actionStarted) return;
          actionStarted = true;
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
    [intl, onBeforeOpenNetwork, onOpenNetwork, onSkipNetwork],
  );

  return useCallback(
    async (network: IServerNetwork): Promise<boolean> => {
      const isCurrentOwner = createPortfolioOwnerGuard(
        owner,
        ownerRef,
        firstIndexOwnerRef,
      );
      if (!isCurrentOwner() || owner.checking || dialogRef.current?.isExist()) {
        return true;
      }
      owner.checking = true;
      try {
        const moneroAccountId = await resolveMoneroAccountId(owner, network.id);
        if (!isCurrentOwner()) return true;
        // An empty HD wallet has no account identity until its explicit Home Enable action.
        const availability = moneroAccountId
          ? await readMoneroAvailability(
              { networkId: network.id, accountId: moneroAccountId },
              isCurrentOwner,
            )
          : await readMoneroWalletAvailability(
              { walletId: owner.walletId, networkId: network.id },
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
