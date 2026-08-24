import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  type IPageNavigationProp,
  useInTabDialog,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SwapInviteeRewardContent } from '../SwapInviteeRewardContent';
import { isSwapInviteeRewardWalletSupported } from '../utils';

const MODAL_OPEN_LOCK_MS = 500;
const ETH_NETWORK_ID = getNetworkIdsMap().eth;

export function useShowSwapInviteeReward({
  accountId,
  indexedAccountId,
}: {
  accountId?: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const { bindWalletInviteCode, getReferralCodeBondStatus } =
    useWalletBoundReferralCode({
      entry: 'tab',
    });
  const dialogRef = useRef<ReturnType<typeof dialogInTab.show> | null>(null);
  const isOpeningRef = useRef(false);
  const openingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prepareRequestIdRef = useRef(0);

  const clearOpeningTimer = useCallback(() => {
    if (openingTimerRef.current) {
      clearTimeout(openingTimerRef.current);
      openingTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearOpeningTimer();
    },
    [clearOpeningTimer],
  );

  useEffect(() => {
    prepareRequestIdRef.current += 1;
    if (!dialogRef.current) {
      isOpeningRef.current = false;
    }
    return () => {
      prepareRequestIdRef.current += 1;
    };
  }, [accountId, indexedAccountId]);

  const openSwapInviteeReward = useCallback(
    (currentEvmAddress?: string) => {
      isOpeningRef.current = true;
      const showAsDialog = !platformEnv.isNative && gtMd;

      if (showAsDialog) {
        let dialog: ReturnType<typeof dialogInTab.show> | null = null;
        dialog = dialogInTab.show({
          title: intl.formatMessage({
            id: ETranslations.referral_swap_reward,
          }),
          floatingPanelProps: {
            width: 480,
          },
          renderContent: (
            <SwapInviteeRewardContent
              accountId={accountId}
              currentEvmAddress={currentEvmAddress}
              onBeforeNavigate={async () => {
                await dialog?.close();
              }}
            />
          ),
          showFooter: false,
          onClose: () => {
            if (dialogRef.current === dialog) {
              dialogRef.current = null;
            }
          },
        });
        dialogRef.current = dialog;
        isOpeningRef.current = false;
        return;
      }

      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapInviteeReward,
        params: {
          accountId,
          currentEvmAddress,
        },
      });
      clearOpeningTimer();
      openingTimerRef.current = setTimeout(() => {
        isOpeningRef.current = false;
        openingTimerRef.current = null;
      }, MODAL_OPEN_LOCK_MS);
    },
    [accountId, clearOpeningTimer, dialogInTab, gtMd, intl, navigation],
  );

  const showSwapInviteeReward = useCallback(() => {
    if (isOpeningRef.current || dialogRef.current) {
      return;
    }

    isOpeningRef.current = true;
    prepareRequestIdRef.current += 1;
    const prepareRequestId = prepareRequestIdRef.current;
    const isCurrentRequest = () =>
      prepareRequestIdRef.current === prepareRequestId;

    const prepareAndOpen = async () => {
      let currentEvmAddress: string | undefined;
      if (accountId) {
        try {
          currentEvmAddress =
            await backgroundApiProxy.serviceReferralCode.getCurrentEvmAccountAddress(
              {
                accountId,
                indexedAccountId,
              },
            );
          if (!isCurrentRequest()) {
            return;
          }
          if (!currentEvmAddress) {
            openSwapInviteeReward();
            return;
          }

          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId,
          });
          const walletInfo =
            await backgroundApiProxy.serviceReferralCode.getReferralCodeWalletInfo(
              {
                walletId,
              },
            );
          if (!isCurrentRequest()) {
            return;
          }

          if (isSwapInviteeRewardWalletSupported(walletInfo, ETH_NETWORK_ID)) {
            const shouldBind = await getReferralCodeBondStatus({
              walletId,
              skipIfTimeout: true,
            });
            if (!isCurrentRequest()) {
              return;
            }
            if (shouldBind) {
              let wallet;
              let shouldOpenReward = false;
              try {
                wallet = await backgroundApiProxy.serviceAccount.getWallet({
                  walletId,
                });
              } catch {
                // The bind dialog can still resolve an eligible wallet itself.
              }
              if (!isCurrentRequest()) {
                return;
              }

              bindWalletInviteCode({
                wallet,
                onClose: () => {
                  if (!isCurrentRequest()) {
                    return;
                  }
                  if (shouldOpenReward) {
                    openSwapInviteeReward(currentEvmAddress);
                  } else {
                    isOpeningRef.current = false;
                  }
                },
                onSuccess: () => {
                  if (isCurrentRequest()) {
                    shouldOpenReward = true;
                  }
                },
              });
              return;
            }
          }
        } catch {
          // Binding checks are best effort and must not block reward details.
        }
      }

      if (isCurrentRequest()) {
        openSwapInviteeReward(currentEvmAddress);
      }
    };

    void prepareAndOpen().catch(() => {
      if (isCurrentRequest()) {
        isOpeningRef.current = false;
      }
    });
  }, [
    accountId,
    bindWalletInviteCode,
    getReferralCodeBondStatus,
    indexedAccountId,
    openSwapInviteeReward,
  ]);

  return { showSwapInviteeReward };
}
