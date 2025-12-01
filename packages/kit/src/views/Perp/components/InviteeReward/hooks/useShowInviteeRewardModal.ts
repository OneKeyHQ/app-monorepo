import { useCallback } from 'react';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { perpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { showInviteeRewardDialog } from '../InviteeRewardContent';

export function useShowInviteeRewardModal() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  const { bindWalletInviteCode, getReferralCodeBondStatus } =
    useWalletBoundReferralCode({
      entry: gtMd ? 'tab' : 'modal',
    });

  const showModal = useCallback(async () => {
    const selectedAccount = await perpsActiveAccountAtom.get();
    const accountId = selectedAccount?.accountId;

    if (!accountId) {
      if (gtMd) {
        await showInviteeRewardDialog(dialogInTab);
      } else {
        navigation.pushModal(EModalRoutes.PerpModal, {
          screen: EModalPerpRoutes.PerpsInviteeRewardModal,
        });
      }
      return;
    }

    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    let wallet;
    try {
      wallet = await backgroundApiProxy.serviceAccount.getWallet({ walletId });
    } catch (error) {
      console.error('Failed to get wallet:', error);
    }

    const shouldBound = await getReferralCodeBondStatus({
      walletId,
    });

    if (shouldBound) {
      bindWalletInviteCode({
        wallet,
        onSuccess: () => {
          if (gtMd) {
            void showInviteeRewardDialog(dialogInTab);
          } else {
            navigation.pushModal(EModalRoutes.PerpModal, {
              screen: EModalPerpRoutes.PerpsInviteeRewardModal,
            });
          }
        },
      });
      return;
    }

    if (gtMd) {
      await showInviteeRewardDialog(dialogInTab);
    } else {
      navigation.pushModal(EModalRoutes.PerpModal, {
        screen: EModalPerpRoutes.PerpsInviteeRewardModal,
      });
    }
  }, [
    gtMd,
    dialogInTab,
    navigation,
    getReferralCodeBondStatus,
    bindWalletInviteCode,
  ]);

  return { showInviteeRewardModal: showModal };
}
