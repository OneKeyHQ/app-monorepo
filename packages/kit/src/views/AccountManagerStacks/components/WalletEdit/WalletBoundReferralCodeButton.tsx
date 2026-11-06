import { useCallback, useRef } from 'react';

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
  runAfterActionListClose,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import type { IReferralBindDisplayStatus } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode/referralBindStatusUtils';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountManagerTestIDs } from '../../testIDs';

function buildButtonState({
  displayStatus,
}: {
  displayStatus: IReferralBindDisplayStatus;
}) {
  return {
    displayStatus,
    shouldBound: displayStatus === 'bind',
  };
}

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
  const { bindWalletInviteCode, getReferralCodeBindDisplayStatus } =
    useWalletBoundReferralCode({
      entry: 'modal',
    });
  const isHdOrHwWallet =
    accountUtils.isHdWallet({ walletId: wallet?.id }) ||
    (accountUtils.isHwWallet({ walletId: wallet?.id }) &&
      !accountUtils.isHwHiddenWallet({
        wallet,
      }));
  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );
  const isReferralBlocked = isBotWallet && isBotWalletDeactivated;

  const {
    result: referralCodeButtonState,
    run: refreshDisplayReferralCodeButton,
    isLoading: isLoadingReferralCodeButton,
  } = usePromiseResult(
    async () => {
      if (!isHdOrHwWallet) {
        return buildButtonState({ displayStatus: 'unknown' });
      }
      const displayStatus = await getReferralCodeBindDisplayStatus({
        walletId: wallet?.id,
      });
      return buildButtonState({
        displayStatus,
      });
    },
    [wallet?.id, getReferralCodeBindDisplayStatus, isHdOrHwWallet],
    {
      initResult: undefined,
      watchLoading: true,
    },
  );

  const shouldBoundReferralCode = referralCodeButtonState?.shouldBound;
  const displayStatus = referralCodeButtonState?.displayStatus ?? 'unknown';
  const isNotBindable = displayStatus === 'notApplicable';
  const showStatusBadge =
    displayStatus === 'bound' || displayStatus === 'notApplicable';
  const notApplicableDesc = intl.formatMessage({
    id: ETranslations.referral_not_applicable_desc,
  });

  // A second tap while the menu is closing would open a second dialog.
  const isOpeningRef = useRef(false);
  // The item is only enabled when the status checked on open is "bind", and
  // the dialog re-checks every wallet itself, so open it right away instead of
  // blocking the menu on another server round trip. Close the menu first so
  // the dialog is not presented over a sheet that is still dismissing.
  const handlePress = useCallback(
    async (close: () => void | Promise<void>) => {
      if (isOpeningRef.current) {
        return;
      }
      isOpeningRef.current = true;
      try {
        await runAfterActionListClose(
          close,
          () => {
            if (isReferralBlocked) {
              showBotWalletDisabledToast('referral');
              return;
            }
            if (!shouldBoundReferralCode) {
              return;
            }
            bindWalletInviteCode({
              wallet,
              onSuccess: () => {
                setTimeout(() => {
                  void refreshDisplayReferralCodeButton();
                }, 200);
              },
            });
          },
          { waitForAnimation: platformEnv.isNative },
        );
      } finally {
        isOpeningRef.current = false;
      }
    },
    [
      isReferralBlocked,
      shouldBoundReferralCode,
      wallet,
      bindWalletInviteCode,
      refreshDisplayReferralCodeButton,
    ],
  );

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
      testID={AccountManagerTestIDs.walletBoundReferralCode}
      icon="GiftOutline"
      label={intl.formatMessage({
        id: ETranslations.referral_wallet_edit_code,
      })}
      extra={
        showStatusBadge ? (
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
        ) : undefined
      }
      onPress={handlePress}
      onClose={onClose}
      // For deactivated bot wallets we keep the item interactive so
      // handlePress can surface the disabled-bot-wallet toast (ActionList.Item
      // suppresses onPress when `disabled` is true).
      disabled={Boolean(!shouldBoundReferralCode && !isReferralBlocked)}
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
