import { type ReactNode, memo, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, useMedia } from '@onekeyhq/components';
import {
  AccountSelectorActiveAccountHome,
  AccountSelectorTriggerHome,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

function AccountSelectorTriggerWithSpotlight({
  isFocus,
  linkNetworkId,
  hideAddress,
}: {
  isFocus: boolean;
  linkNetworkId?: string;
  hideAddress?: boolean;
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
  const { gtMd } = useMedia();
  const [isFocus, setIsFocus] = useState(false);

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
    showNetworkSelector && tabRoute === ETabRoutes.Home && gtMd;

  return (
    <XStack gap="$3" ai="center">
      <MemoizedAccountSelectorTriggerWithSpotlight
        isFocus={isFocus}
        linkNetworkId={linkNetworkId}
        hideAddress={hideAddress}
      />
      {shouldShowNetworkSelector ? (
        <NetworkSelectorTriggerHome
          num={0}
          recordNetworkHistoryEnabled
          hideOnNoAccount
        />
      ) : null}
      {showAccountInfo ? (
        <AccountSelectorActiveAccountHome
          num={0}
          showAccountAddress={false}
          showCopyButton={tabRoute === ETabRoutes.Home}
          showCreateAddressButton={false}
          showNoAddressTip={false}
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
  if (!(platformEnv.isWeb && gtMd)) {
    return children ? <>{children}</> : null;
  }

  return <WalletConnectionGroup {...props} />;
}
