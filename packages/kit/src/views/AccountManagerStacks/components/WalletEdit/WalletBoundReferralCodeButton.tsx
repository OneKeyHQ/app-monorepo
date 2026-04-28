import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Badge,
  Icon,
  Popover,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import {
  shouldRevalidateReferralBindStatusCache,
  shouldShowReferralBindEntry,
} from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode/referralBindStatusUtils';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function NotApplicableTooltip({ description }: { description: string }) {
  const renderTrigger = (
    <Icon name="InfoCircleOutline" color="$iconSubdued" size="$4" />
  );

  if (platformEnv.isNative) {
    return (
      <Popover
        title=""
        showHeader={false}
        placement="top-end"
        renderTrigger={renderTrigger}
        renderContent={
          <YStack p="$5">
            <SizableText size="$bodyLg">{description}</SizableText>
          </YStack>
        }
      />
    );
  }

  return (
    <Tooltip
      placement="top-end"
      renderTrigger={renderTrigger}
      renderContent={description}
    />
  );
}

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
    result: referralCodeButtonState,
    run: refreshDisplayReferralCodeButton,
    isLoading: isLoadingReferralCodeButton,
  } = usePromiseResult(
    async () => {
      if (!isHdOrHwWallet) {
        return { shouldBound: false, isNotBindable: false };
      }
      const referralCodeInfo =
        await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
          walletId: wallet?.id || '',
        });
      if (!referralCodeInfo) {
        const shouldBound = await getReferralCodeBondStatus({
          walletId: wallet?.id,
        });
        const latestReferralCodeInfo =
          await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
            walletId: wallet?.id || '',
          });
        return {
          shouldBound,
          isNotBindable: latestReferralCodeInfo?.bindable === false,
        };
      }
      if (shouldRevalidateReferralBindStatusCache(referralCodeInfo)) {
        const shouldBound = await getReferralCodeBondStatus({
          walletId: wallet?.id,
        });
        const latestReferralCodeInfo =
          await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
            walletId: wallet?.id || '',
          });
        return {
          shouldBound,
          isNotBindable: latestReferralCodeInfo?.bindable === false,
        };
      }
      return {
        shouldBound: shouldShowReferralBindEntry(referralCodeInfo),
        isNotBindable: referralCodeInfo?.bindable === false,
      };
    },
    [wallet?.id, getReferralCodeBondStatus, isHdOrHwWallet],
    {
      initResult: undefined,
      watchLoading: true,
    },
  );

  const shouldBoundReferralCode = referralCodeButtonState?.shouldBound;
  const isNotBindable = referralCodeButtonState?.isNotBindable;
  const notApplicableDesc = intl.formatMessage({
    id: ETranslations.referral_not_applicable_desc,
  });

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
          <XStack ai="center" gap="$1" flexShrink={0}>
            <Badge
              badgeSize="sm"
              badgeType={isNotBindable ? 'default' : 'info'}
            >
              <Badge.Text size="$bodySmMedium">
                {intl.formatMessage({
                  id: isNotBindable
                    ? ETranslations.referral_not_applicable
                    : ETranslations.referral_wallet_bind_code_finish,
                })}
              </Badge.Text>
            </Badge>
            {isNotBindable ? (
              <NotApplicableTooltip description={notApplicableDesc} />
            ) : null}
          </XStack>
        )
      }
      onPress={handlePress}
      isLoading={isLoading}
      onClose={onClose}
      disabled={Boolean(!shouldBoundReferralCode)}
      extraInteractiveWhenDisabled={Boolean(isNotBindable)}
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
