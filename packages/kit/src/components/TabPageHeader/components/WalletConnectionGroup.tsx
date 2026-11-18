import { type ReactNode, memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Spinner,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorActiveAccount';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerHome';
import { LazyAllNetworksManagerTrigger } from '@onekeyhq/kit/src/components/AccountSelector/LazyAllNetworksManagerTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useActiveAccount,
  useIsAccountSelectorSyncLoading,
} from '../../../states/jotai/contexts/accountSelector';

function AccountSelectorTriggerWithSpotlight({
  isFocus,
  linkNetworkId,
  hideAddress,
  desktopHeader,
  tertiaryButton,
}: {
  isFocus: boolean;
  linkNetworkId?: string;
  hideAddress?: boolean;
  desktopHeader?: boolean;
  tertiaryButton?: boolean;
}) {
  const intl = useIntl();
  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.switchDappAccount,
  );
  const [isLocked] = useAppIsLockedAtom();

  const spotlightVisible = useMemo(
    () => tourTimes === 1 && isFocus && !isLocked,
    [isFocus, isLocked, tourTimes],
  );

  return (
    <AccountSelectorTriggerHome
      num={0}
      key="accountSelectorTrigger"
      linkNetworkId={linkNetworkId}
      hideAddress={hideAddress}
      desktopHeader={desktopHeader}
      tertiaryButton={tertiaryButton}
      spotlightProps={{
        visible: spotlightVisible,
        content: (
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.spotlight_account_alignment_desc,
            })}
          </SizableText>
        ),
        onConfirm: () => {
          void tourVisited(2);
        },
        childrenPaddingVertical: 0,
      }}
    />
  );
}

const MemoizedAccountSelectorTriggerWithSpotlight = memo(
  AccountSelectorTriggerWithSpotlight,
);

// The extension keeps one-click copy beside the account name, as its old
// header had it: there the address goes into exchanges, dApps and explorers
// on the same computer. The phone copies from Receive.
function HomeBalanceAccountCopy() {
  const {
    activeAccount: { wallet, account },
  } = useActiveAccount({ num: 0 });
  if (
    accountUtils.hasNoUsableWallet({ wallet, account }) ||
    (wallet?.type === WALLET_TYPE_HD && !wallet.backuped)
  ) {
    return null;
  }
  return (
    <AccountSelectorActiveAccountHome
      num={0}
      showAccountAddress={false}
      showCopyButton
      showCreateAddressButton={false}
      showNoAddressTip={false}
    />
  );
}

// Phone wallet home: the account names itself above the balance; the header
// row holds the profile avatar, search and network. On web this row shows
// only in the extension's popup and side panel.
export function HomeBalanceAccountTrigger() {
  const [isFocus, setIsFocus] = useState(false);
  useListenTabFocusState(
    ETabRoutes.Home,
    async (focus: boolean, hideByModal: boolean) => {
      setIsFocus(!hideByModal && focus);
    },
  );
  const trigger = (
    <MemoizedAccountSelectorTriggerWithSpotlight
      isFocus={isFocus}
      tertiaryButton
    />
  );
  if (platformEnv.isNative) {
    return trigger;
  }
  // The account button's hover fill reaches 3 past its chevron and the copy
  // button's 4 to 5 past its icon, so 8 lets the two fills meet.
  return (
    <XStack alignItems="center" gap="$2">
      {/* Gives the button's 100% max width a definite box, so a long name
          shrinks with an ellipsis before the copy button instead. */}
      <Stack flexShrink={1} minWidth={0}>
        {trigger}
      </Stack>
      <HomeBalanceAccountCopy />
    </XStack>
  );
}

interface IWalletConnectionGroupProps {
  tabRoute: ETabRoutes;
  showNetworkSelector?: boolean;
  showAccountInfo?: boolean;
}

export function WalletConnectionGroup({
  tabRoute,
  showNetworkSelector = true,
  showAccountInfo = true,
}: IWalletConnectionGroupProps) {
  const { md } = useMedia();
  const isMobileLayout = md || platformEnv.isNative;
  const {
    activeAccount: { wallet, network, account },
  } = useActiveAccount({
    num: 0,
  });
  const [isFocus, setIsFocus] = useState(false);

  const hasNoUsableWallet = accountUtils.hasNoUsableWallet({
    wallet,
    account,
  });

  const isNonBackedUpWallet = useMemo(() => {
    return wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped;
  }, [wallet]);

  useListenTabFocusState(
    ETabRoutes.Home,
    async (focus: boolean, hideByModal: boolean) => {
      setIsFocus(!hideByModal && focus);
    },
  );

  // Determine special settings for certain routes
  let linkNetworkId: string | undefined;
  let hideAddress: boolean | undefined;
  if (
    tabRoute === ETabRoutes.WebviewPerpTrade ||
    tabRoute === ETabRoutes.Perp
  ) {
    linkNetworkId = PERPS_NETWORK_ID;
    hideAddress = false;
  }

  const shouldShowNetworkSelector =
    showNetworkSelector && tabRoute === ETabRoutes.Home;

  const renderNetworkSelectorTrigger = useCallback(
    (size?: 'small' | 'large', desktopHeader?: boolean) => {
      if (!shouldShowNetworkSelector || isNonBackedUpWallet) {
        return null;
      }

      if (
        network?.isAllNetworks &&
        !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
      ) {
        return (
          <LazyAllNetworksManagerTrigger
            num={0}
            unifiedMode
            desktopHeader={desktopHeader}
          />
        );
      }
      return (
        <NetworkSelectorTriggerHome
          num={0}
          size={size}
          recordNetworkHistoryEnabled
          hideOnNoAccount
          unifiedMode
          desktopHeader={desktopHeader}
        />
      );
    },
    [
      network?.isAllNetworks,
      shouldShowNetworkSelector,
      isNonBackedUpWallet,
      wallet?.id,
    ],
  );

  const isSyncLoading = useIsAccountSelectorSyncLoading(0);

  if (
    !platformEnv.isWebDappMode &&
    hasNoUsableWallet &&
    tabRoute === ETabRoutes.Home
  ) {
    if (isSyncLoading) {
      return <Spinner size="small" />;
    }
    return null;
  }

  if (isMobileLayout) {
    return (
      <XStack flex={1} ai="center" jc="space-between">
        <XStack gap="$3" ai="center">
          <MemoizedAccountSelectorTriggerWithSpotlight
            isFocus={isFocus}
            linkNetworkId={linkNetworkId}
            hideAddress={hideAddress}
          />
          {showAccountInfo && !isNonBackedUpWallet ? (
            <AccountSelectorActiveAccountHome
              num={0}
              showAccountAddress={false}
              showCopyButton={tabRoute === ETabRoutes.Home}
              showCreateAddressButton={false}
              showNoAddressTip={false}
            />
          ) : null}
        </XStack>
        {renderNetworkSelectorTrigger('small')}
      </XStack>
    );
  }

  // Desktop: 16 between the triggers' contents, so their hover shapes (6 in on
  // the content side, 2 on the chevron side) sit 8 apart. Those shapes are 32
  // high but take no layout height, so the row holds that 32 itself.
  return (
    <XStack gap="$4" ai="center" minHeight="$8">
      <MemoizedAccountSelectorTriggerWithSpotlight
        isFocus={isFocus}
        linkNetworkId={linkNetworkId}
        hideAddress={hideAddress}
        desktopHeader
      />
      {renderNetworkSelectorTrigger(undefined, true)}
      {showAccountInfo && !isNonBackedUpWallet ? (
        <AccountSelectorActiveAccountHome
          num={0}
          showAccountAddress={false}
          showCopyButton={tabRoute === ETabRoutes.Home}
          showCreateAddressButton={false}
          showNoAddressTip={false}
          desktopHeader
        />
      ) : null}
    </XStack>
  );
}

interface IWalletConnectionForWebProps extends IWalletConnectionGroupProps {
  children?: ReactNode;
}

/**
 * Wrapper component for web platform that only renders on web
 */
export function WalletConnectionForWeb({
  children,
  ...props
}: IWalletConnectionForWebProps) {
  const { gtMd } = useMedia();

  // Only show on web platform
  if (!(platformEnv.isWebDappMode && gtMd)) {
    return children ? <>{children}</> : null;
  }

  return <WalletConnectionGroup {...props} />;
}
