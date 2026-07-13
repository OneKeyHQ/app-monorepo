import { Suspense, lazy } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useWebDappRealAddress } from './useWebDappRealAddress';
import { WebAccountPanelPopover } from './WebAccountPanelPopover';

export interface IWebAccountSelectorTriggerProps {
  tabRoute: ETabRoutes;
}

// The Popover's own Trigger wrapper drives the open-on-press behavior; this
// noop only exists so the trigger XStack keeps a Pressable press state for
// pressStyle to animate against.
const noop = () => undefined;

const LazyPerpsBalancePill = lazy(async () => {
  const { PerpsBalancePill } = await import('./PerpsBalancePill');
  return { default: PerpsBalancePill };
});

export function WebAccountSelectorTrigger({
  tabRoute,
}: IWebAccountSelectorTriggerProps) {
  const {
    activeAccount: { account, dbAccount, indexedAccount },
  } = useActiveAccount({ num: 0 });

  // In web-dapp all-networks mode an indexed account's address is a mock
  // placeholder; resolve the real EVM address for the header.
  const realAddress = useWebDappRealAddress({
    address: account?.address,
    indexedAccountId: indexedAccount?.id,
  });
  const address = realAddress
    ? accountUtils.shortenAddress({
        address: realAddress,
        leadingLength: 4,
        trailingLength: 4,
      })
    : '';

  const isPerpsRoute =
    tabRoute === ETabRoutes.Perp || tabRoute === ETabRoutes.WebviewPerpTrade;

  const trigger = (
    <XStack
      h="$8"
      ai="center"
      pl="$2"
      pr="$1"
      bg="$bgStrong"
      borderRadius="$full"
      hoverStyle={{ bg: '$bgStrongHover' }}
      pressStyle={{ bg: '$bgStrongActive' }}
      onPress={noop}
      role="button"
      testID="web-account-selector-trigger"
    >
      <AccountAvatar
        size={20}
        borderRadius="$full"
        outlineWidth={1}
        outlineStyle="solid"
        outlineColor="$borderSubdued"
        outlineOffset={-1}
        account={account}
        dbAccount={dbAccount}
        indexedAccount={indexedAccount}
      />
      <XStack ai="center" pl="$2" pr="$3">
        <SizableText size="$bodyLg" color="$text">
          {address}
        </SizableText>
      </XStack>
      {isPerpsRoute ? (
        <Suspense fallback={null}>
          <LazyPerpsBalancePill userAddress={realAddress} />
        </Suspense>
      ) : null}
    </XStack>
  );

  return <WebAccountPanelPopover renderTrigger={trigger} connected />;
}
