import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, SizableText } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

  const {
    result: displayReferralCodeButton,
    run: refreshDisplayReferralCodeButton,
  } = usePromiseResult(
    async () => {
      const referralCodeInfo =
        await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
          walletId: wallet?.id || '',
        });
      return referralCodeInfo?.walletId && !referralCodeInfo?.isBound;
    },
    [wallet?.id],
    {
      initResult: undefined,
    },
  );

  const handlePress = useCallback(async () => {
    if (isLoading) {
      return;
    }
    if (!displayReferralCodeButton) {
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
    displayReferralCodeButton,
    getReferralCodeBondStatus,
    wallet,
    bindWalletInviteCode,
    refreshDisplayReferralCodeButton,
  ]);

  if (displayReferralCodeButton === undefined) {
    return <ActionList.SkeletonItem />;
  }

  if (!displayReferralCodeButton) {
    return null;
  }

  return (
    <ActionList.Item
      testID="wallet-bound-referral-code-button"
      icon="GiftOutline"
      label={intl.formatMessage({
        id: ETranslations.referral_wallet_edit_code,
      })}
      onPress={handlePress}
      isLoading={isLoading}
      onClose={onClose}
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
