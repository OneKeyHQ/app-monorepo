import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Badge } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function WalletBoundReferralCodeButtonView({
  wallet,
  onClose,
}: {
  wallet: IDBWallet | undefined;
  onClose: () => void;
}) {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const { bindWalletInviteCode, getReferralCodeBondStatus } =
    useWalletBoundReferralCode({
      entry: 'modal',
    });
  const isHdOrHwWallet =
    accountUtils.isHdWallet({ walletId: wallet?.id }) ||
    (accountUtils.isHwWallet({ walletId: wallet?.id }) &&
      !accountUtils.isHwHiddenWallet({
        wallet,
      }));

  const {
    result: shouldBoundReferralCode,
    run: refreshDisplayReferralCodeButton,
    isLoading: isLoadingReferralCodeButton,
  } = usePromiseResult(
    async () => {
      if (!isHdOrHwWallet) {
        return false;
      }
      const referralCodeInfo =
        await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
          walletId: wallet?.id || '',
        });
      if (!referralCodeInfo) {
        const shouldBound = await getReferralCodeBondStatus({
          walletId: wallet?.id,
        });
        return shouldBound;
      }
      return referralCodeInfo?.walletId && !referralCodeInfo?.isBound;
    },
    [wallet?.id, getReferralCodeBondStatus, isHdOrHwWallet],
    {
      initResult: undefined,
      watchLoading: true,
    },
  );

  const handlePress = useCallback(async () => {
    if (isLoading) {
      return;
    }
    if (!shouldBoundReferralCode) {
      return;
    }
    try {
      setIsLoading(true);
      const shouldBound = await getReferralCodeBondStatus({
        walletId: wallet?.id,
      });
      if (!shouldBound) {
        return;
      }
      bindWalletInviteCode({
        wallet,
        onSuccess: () =>
          setTimeout(() => refreshDisplayReferralCodeButton(), 200),
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    shouldBoundReferralCode,
    getReferralCodeBondStatus,
    wallet,
    bindWalletInviteCode,
    refreshDisplayReferralCodeButton,
  ]);

  if (!isHdOrHwWallet) {
    return null;
  }

  if (wallet?.isMocked) {
    return null;
  }

  if (isLoadingReferralCodeButton) {
    return <ActionList.SkeletonItem />;
  }

  return (
    <ActionList.Item
      testID="wallet-bound-referral-code-button"
      icon="GiftOutline"
      label={intl.formatMessage({
        id: ETranslations.referral_wallet_edit_code,
      })}
      extra={
        shouldBoundReferralCode ? undefined : (
          <Badge badgeSize="sm" badgeType="info">
            <Badge.Text>
              {intl.formatMessage({
                id: ETranslations.referral_wallet_bind_code_finish,
              })}
            </Badge.Text>
          </Badge>
        )
      }
      onPress={handlePress}
      isLoading={isLoading}
      onClose={onClose}
      disabled={Boolean(!shouldBoundReferralCode)}
    />
  );
}

export function WalletBoundReferralCodeButton({
  wallet,
  onClose,
}: {
  wallet: IDBWallet | undefined;
  onClose: () => void;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <WalletBoundReferralCodeButtonView wallet={wallet} onClose={onClose} />
    </AccountSelectorProviderMirror>
  );
}
