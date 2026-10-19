import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  SizableText,
  YStack,
  rootNavigationRef,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import {
  useAccountSelectorStorageInitDoneAtom,
  useActiveAccount,
  useIsAccountSelectorSyncLoading,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms';
import { InvitedByFriendContent } from '@onekeyhq/kit/src/views/ReferFriends/pages/InvitedByFriend/components';
import { useOnboardingConnectWalletLoadingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import {
  clearWebReferralCodeIfMatch,
  readWebReferralCode,
  subscribeWebReferralCode,
} from '../../utils/webReferralCode';

import type { IWebReferralCodeRecord } from '../../utils/webReferralCode';

type IBindIdentity = {
  record: IWebReferralCodeRecord;
  accountId: string;
  address: string;
  networkId: string;
  accountName: string;
};

const accountSelectorConfig = {
  sceneName: EAccountSelectorSceneName.home,
  sceneUrl: '',
};
const enabledNum = [0];
const STATUS_TIMEOUT_MS = 3000;

function sameIdentity(a: IBindIdentity | undefined, b: IBindIdentity): boolean {
  return (
    a?.record.code === b.record.code &&
    a.record.capturedAt === b.record.capturedAt &&
    a.accountId === b.accountId &&
    a.address === b.address &&
    a.networkId === b.networkId
  );
}

function identityKey(identity: IBindIdentity): string {
  return JSON.stringify([
    identity.record.code,
    identity.record.capturedAt,
    identity.accountId,
    identity.address,
    identity.networkId,
  ]);
}

function canShowPrompt(): boolean {
  if (
    /^\/r(?:\/|$)/u.test(globalThis.location?.pathname ?? '') ||
    /^\/oauth_callback_web\/?$/u.test(globalThis.location?.pathname ?? '')
  ) {
    return false;
  }
  const rootState = rootNavigationRef.current?.getRootState();
  return (
    !rootState ||
    rootState.routes[rootState.index ?? 0]?.name === ERootRoutes.Main
  );
}

function WebReferralBindContainerInner() {
  const intl = useIntl();
  const { navigationToMessageConfirmAsync } = useSignatureConfirm({
    accountId: '',
    networkId: '',
  });
  const [record, setRecord] = useState(readWebReferralCode);
  const [routeEpoch, setRouteEpoch] = useState(0);
  const [storageInitDone] = useAccountSelectorStorageInitDoneAtom();
  const [connectLoading] = useOnboardingConnectWalletLoadingAtom();
  const syncLoading = useIsAccountSelectorSyncLoading(0);
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const { activeAccount } = useActiveAccount({ num: 0 });
  const dialogRef = useRef<IDialogInstance | undefined>(undefined);
  const openIdentityRef = useRef<IBindIdentity | undefined>(undefined);
  const shownIdentitiesRef = useRef(new Set<string>());
  const mountedRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeWebReferralCode(() => {
      setRecord(readWebReferralCode());
    });
    // A route may capture before this container mounts or subscribes.
    setRecord(readWebReferralCode());
    return unsubscribe;
  }, []);

  useEffect(
    () =>
      rootNavigationRef.current?.addListener('state', () => {
        setRouteEpoch((value) => value + 1);
      }),
    [],
  );

  const account = activeAccount.account;
  const activeNetworkId = activeAccount.network?.id;
  const selectedNetworkId =
    selectedAccount.networkId ?? getNetworkIdsMap().onekeyall;
  let networkId = activeNetworkId;
  if (activeNetworkId === getNetworkIdsMap().onekeyall) {
    networkId = account?.createAtNetwork;
  }
  if (!networkUtils.isEvmNetwork({ networkId })) {
    networkId = undefined;
  }
  const address = account?.address?.trim();
  const identity: IBindIdentity | undefined = useMemo(
    () =>
      record &&
      storageInitDone &&
      activeAccount.ready &&
      !syncLoading &&
      !connectLoading &&
      selectedAccount.walletId === WALLET_TYPE_EXTERNAL &&
      activeAccount.wallet?.id === WALLET_TYPE_EXTERNAL &&
      selectedNetworkId === activeNetworkId &&
      account?.id &&
      selectedAccount.othersWalletAccountId === account.id &&
      networkUtils.isEvmNetwork({ networkId }) &&
      networkId &&
      address
        ? {
            record,
            accountId: account.id,
            address,
            networkId,
            accountName: activeAccount.accountName,
          }
        : undefined,
    [
      record,
      storageInitDone,
      activeAccount.ready,
      activeAccount.wallet?.id,
      activeAccount.accountName,
      syncLoading,
      connectLoading,
      selectedAccount.walletId,
      selectedNetworkId,
      activeNetworkId,
      selectedAccount.othersWalletAccountId,
      account?.id,
      networkId,
      address,
    ],
  );

  const previousIdentityKeyRef = useRef<string | undefined>(undefined);
  const identityRef = useRef(identity);
  const currentIdentityKey = identity ? identityKey(identity) : undefined;
  if (previousIdentityKeyRef.current !== currentIdentityKey) {
    // Invalidate pending signing even if the same identity appears again later.
    generationRef.current += 1;
    previousIdentityKeyRef.current = currentIdentityKey;
  }
  identityRef.current = identity;

  useEffect(() => {
    generationRef.current += 1;
    mountedRef.current = true;
    return () => {
      generationRef.current += 1;
      mountedRef.current = false;
      identityRef.current = undefined;
      try {
        void Promise.resolve(dialogRef.current?.close()).catch(() => undefined);
      } catch {
        // A stale dialog cannot authorize a bind after this container unmounts.
      }
      dialogRef.current = undefined;
      openIdentityRef.current = undefined;
    };
  }, []);

  const stillCurrent = useCallback(
    (expected: IBindIdentity, generation: number): boolean => {
      const currentRecord = readWebReferralCode();
      return (
        mountedRef.current &&
        generationRef.current === generation &&
        sameIdentity(identityRef.current, expected) &&
        currentRecord?.code === expected.record.code &&
        currentRecord.capturedAt === expected.record.capturedAt
      );
    },
    [],
  );

  useEffect(() => {
    if (
      dialogRef.current &&
      openIdentityRef.current &&
      !sameIdentity(identity, openIdentityRef.current)
    ) {
      try {
        void Promise.resolve(dialogRef.current.close()).catch(() => undefined);
      } catch {
        // The stale prompt remains unable to bind because identity changed.
      }
    }
  }, [identity]);

  useEffect(() => {
    if (
      !identity ||
      dialogRef.current ||
      shownIdentitiesRef.current.has(identityKey(identity)) ||
      !canShowPrompt()
    ) {
      return;
    }

    let cancelled = false;
    const current = identity;
    const generation = generationRef.current;
    const normalizedAddress =
      normalizeTokenContractAddress({
        networkId: current.networkId,
        contractAddress: current.address,
      }) || current.address;

    const checkAndShow = async () => {
      try {
        const result =
          await backgroundApiProxy.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2(
            [{ address: normalizedAddress, networkId: current.networkId }],
            STATUS_TIMEOUT_MS,
          );
        if (
          cancelled ||
          !stillCurrent(current, generation) ||
          !canShowPrompt()
        ) {
          return;
        }
        const status = result?.[`${current.networkId}:${normalizedAddress}`];
        if (
          !status ||
          status.bound === true ||
          status.bindable !== true ||
          status.reason === 'already_bound' ||
          status.reason === 'exceeded_bind_window'
        ) {
          return;
        }

        // Suppress another automatic prompt for this identity until this page remounts.
        shownIdentitiesRef.current.add(identityKey(current));
        openIdentityRef.current = current;
        const ownDialog = Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.sidebar_refer_a_friend,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_confirm,
          }),
          onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
          renderContent: (
            <YStack gap="$3" testID="web-referral-bind-prompt">
              <YStack testID="web-referral-bind-code">
                <InvitedByFriendContent referralCode={current.record.code} />
              </YStack>
              <SizableText>
                {current.accountName || current.address}
              </SizableText>
              <SizableText testID="web-referral-bind-address">
                {current.address}
              </SizableText>
            </YStack>
          ),
          onClose: () => {
            if (dialogRef.current === ownDialog) {
              dialogRef.current = undefined;
              openIdentityRef.current = undefined;
              if (mountedRef.current) {
                // Recheck a newer identity once the stale dialog is gone.
                setRouteEpoch((value) => value + 1);
              }
            }
          },
          onConfirm: async ({ close, preventClose }) => {
            preventClose();
            try {
              // Wait for the dialog portal to leave before opening signature UI.
              await close({ flag: 'confirm' });
              if (!stillCurrent(current, generation)) return;
              let message =
                await backgroundApiProxy.serviceReferralCode.getBoundReferralCodeUnsignedMessage(
                  {
                    address: current.address,
                    networkId: current.networkId,
                    inviteCode: current.record.code,
                  },
                );
              if (!stillCurrent(current, generation)) return;
              message = autoFixPersonalSignMessage({ message });
              const signature = await navigationToMessageConfirmAsync({
                accountId: current.accountId,
                networkId: current.networkId,
                unsignedMessage: {
                  type: EMessageTypesEth.PERSONAL_SIGN,
                  message,
                  payload: [message, current.address],
                },
                walletInternalSign: true,
                sameModal: false,
                skipBackupCheck: true,
              });
              if (!signature || !stillCurrent(current, generation)) return;
              const bound =
                await backgroundApiProxy.serviceReferralCode.boundReferralCodeWithSignedMessage(
                  {
                    address: current.address,
                    networkId: current.networkId,
                    referralCode: current.record.code,
                    signature,
                  },
                );
              if (bound && stillCurrent(current, generation)) {
                clearWebReferralCodeIfMatch(current.record);
              }
            } catch {
              // Rejected signatures and transient errors keep the code for this tab.
            }
          },
        });
        dialogRef.current = ownDialog;
      } catch {
        // Missing or failed eligibility never opens a bind prompt.
      }
    };
    void checkAndShow();
    return () => {
      cancelled = true;
    };
  }, [
    identity,
    intl,
    navigationToMessageConfirmAsync,
    routeEpoch,
    stillCurrent,
  ]);

  return null;
}

export function WebReferralBindContainer() {
  if (!platformEnv.isWebDappMode) {
    return null;
  }
  return (
    <AccountSelectorProviderMirror
      config={accountSelectorConfig}
      enabledNum={enabledNum}
    >
      <WebReferralBindContainerInner />
    </AccountSelectorProviderMirror>
  );
}
