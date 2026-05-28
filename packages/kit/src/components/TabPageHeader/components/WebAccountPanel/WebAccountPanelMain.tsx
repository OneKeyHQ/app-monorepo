import { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  IconButton,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useShowDepositWithdrawModal } from '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal';
import { usePerpsComputedAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { WebAccountPanelFooter } from './atoms/WebAccountPanelFooter';

export interface IWebAccountPanelMainProps {
  onNavigateAccountList: () => void;
  onNavigateSettings: () => void;
  onNavigateArticles: () => void;
  onHelp?: () => void;
  onDownloadApp?: () => void;
  onRequestClose: () => void;
}

function PerpsSection({ onRequestClose }: { onRequestClose: () => void }) {
  const intl = useIntl();
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const accountValue = computedValue?.accountValue;
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  const displayValue = accountValue
    ? new BigNumber(accountValue).toFormat(2)
    : '--';

  const handleRefresh = useCallback(() => {
    // TODO: hook up perps refresh once exposed via service action
  }, []);

  const handleDeposit = useCallback(async () => {
    await showDepositWithdrawModal('deposit');
    onRequestClose();
  }, [showDepositWithdrawModal, onRequestClose]);

  const handleWithdraw = useCallback(async () => {
    await showDepositWithdrawModal('withdraw');
    onRequestClose();
  }, [showDepositWithdrawModal, onRequestClose]);

  return (
    <YStack gap="$3" w="100%">
      <XStack ai="center" jc="space-between" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
          {intl.formatMessage({ id: ETranslations.global_perp })}
        </SizableText>
        <Button
          size="small"
          variant="tertiary"
          onPress={handleRefresh}
          testID="web-account-panel-main-perps-balance"
        >
          ${displayValue}
        </Button>
      </XStack>
      <XStack ai="center" gap="$2" w="100%">
        <Button
          flex={1}
          variant="primary"
          onPress={handleDeposit}
          testID="web-account-panel-main-deposit"
        >
          {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
        </Button>
        <Button
          flex={1}
          variant="secondary"
          onPress={handleWithdraw}
          testID="web-account-panel-main-withdraw"
        >
          {intl.formatMessage({ id: ETranslations.perp_trade_withdraw })}
        </Button>
      </XStack>
    </YStack>
  );
}

export function WebAccountPanelMain({
  onNavigateAccountList,
  onNavigateSettings,
  onNavigateArticles,
  onHelp,
  onDownloadApp,
  onRequestClose,
}: IWebAccountPanelMainProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const {
    activeAccount: { account, dbAccount, indexedAccount },
  } = useActiveAccount({ num: 0 });

  // TODO: Portfolio total. `useLastConfirmedOverviewBalanceAtom` (home
  // accountOverview context) can't be read here — Popover content renders
  // through a Portal that escapes ancestor providers, and the
  // accountOverview store is intentionally page-scoped (no global mirror,
  // see JotaiContextStoreMirrorTracker.tsx). A follow-up will surface
  // this value through a route-agnostic source.
  const portfolioDisplay = '--';
  const address = account?.address
    ? accountUtils.shortenAddress({ address: account.address })
    : '';

  const handleCopyAddress = useCallback(() => {
    if (account?.address) {
      copyText(account.address);
    }
  }, [account?.address, copyText]);

  const handleDisconnect = useCallback(() => {
    // TODO: hook up disconnect (switch to next account or close panel + go unconnected)
    onRequestClose();
  }, [onRequestClose]);

  const handleRefreshPortfolio = useCallback(() => {
    // TODO: hook up overview refresh once exposed via service action
  }, []);

  return (
    <YStack w="100%">
      <YStack p="$5" gap="$5" w="100%">
        <XStack ai="center" jc="space-between" w="100%">
          <XStack
            ai="center"
            gap="$2"
            borderRadius="$full"
            cursor="pointer"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
            onPress={onNavigateAccountList}
            role="button"
            testID="web-account-panel-main-account-trigger"
          >
            <AccountAvatar
              size="$6"
              borderRadius="$full"
              account={account}
              dbAccount={dbAccount}
              indexedAccount={indexedAccount}
            />
            <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
              {address}
            </SizableText>
            <IconButton
              icon="SwitchHorOutline"
              size="small"
              variant="tertiary"
              iconSize="$5"
              focusable={false}
              testID="web-account-panel-main-switch-account"
            />
          </XStack>
          <XStack ai="center" gap="$1">
            <IconButton
              icon="Copy3Outline"
              size="small"
              variant="tertiary"
              iconSize="$5"
              onPress={handleCopyAddress}
              testID="web-account-panel-main-copy"
            />
            <IconButton
              icon="BrokenLink2Outline"
              size="small"
              variant="tertiary"
              iconSize="$5"
              onPress={handleDisconnect}
              testID="web-account-panel-main-disconnect"
            />
          </XStack>
        </XStack>
        <XStack ai="center" jc="space-between" gap="$1" w="100%">
          <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
            {intl.formatMessage({ id: ETranslations.global_portfolio })}
          </SizableText>
          <Button
            size="small"
            variant="tertiary"
            onPress={handleRefreshPortfolio}
            testID="web-account-panel-main-portfolio-balance"
          >
            {portfolioDisplay}
          </Button>
        </XStack>
        <Divider />
        <PerpsSection onRequestClose={onRequestClose} />
      </YStack>
      <WebAccountPanelFooter
        connected
        onDownloadApp={onDownloadApp}
        onArticles={onNavigateArticles}
        onHelp={onHelp}
        onSettings={onNavigateSettings}
      />
    </YStack>
  );
}
