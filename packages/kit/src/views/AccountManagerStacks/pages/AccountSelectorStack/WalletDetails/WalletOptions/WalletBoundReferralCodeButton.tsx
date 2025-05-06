import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { WalletOptionItem } from './WalletOptionItem';

function WalletBoundReferralCodeButtonView({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const intl = useIntl();
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
      initResult: false,
    },
  );

  const handlePress = useCallback(async () => {
    const shouldBound = await getReferralCodeBondStatus(wallet?.id);
    if (!shouldBound) {
      return;
    }
    bindWalletInviteCode({
      wallet,
      onSuccess: () =>
        setTimeout(() => refreshDisplayReferralCodeButton(), 200),
    });
  }, [
    bindWalletInviteCode,
    getReferralCodeBondStatus,
    wallet,
    refreshDisplayReferralCodeButton,
  ]);

  if (!displayReferralCodeButton) {
    return null;
  }

  return (
    <WalletOptionItem
      testID="wallet-bound-referral-code-button"
      icon="GiftOutline"
      label={intl.formatMessage({ id: ETranslations.referral_your_code })}
      onPress={handlePress}
    />
  );
}

export function WalletBoundReferralCodeButton({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <WalletBoundReferralCodeButtonView wallet={wallet} />
    </AccountSelectorProviderMirror>
  );
}
