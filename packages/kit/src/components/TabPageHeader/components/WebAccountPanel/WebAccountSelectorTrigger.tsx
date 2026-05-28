import type { GestureResponderEvent } from 'react-native';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { PerpsAccountNumberValue } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/components/PerpsAccountNumberValue';
import { useShowPortfolio } from '@onekeyhq/kit/src/views/Perp/hooks/useShowPortfolio';
import { PerpsAccountSelectorProviderMirror } from '@onekeyhq/kit/src/views/Perp/PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '@onekeyhq/kit/src/views/Perp/PerpsProviderMirror';
import { usePerpsComputedAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { WebAccountPanelPopover } from './WebAccountPanelPopover';

export interface IWebAccountSelectorTriggerProps {
  tabRoute: ETabRoutes;
}

function PerpsBalancePillInner() {
  const intl = useIntl();
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const accountValue = computedValue?.accountValue;
  const { showPortfolio } = useShowPortfolio();

  const isEmptyAccount = !accountValue || new BigNumber(accountValue).lte(0);

  const handlePress = (e: GestureResponderEvent) => {
    e.stopPropagation();
    showPortfolio();
  };

  return (
    <XStack
      ai="center"
      jc="center"
      gap="$1"
      px="$2"
      h={26}
      borderRadius="$full"
      bg={isEmptyAccount ? '$brand9' : '$neutral4'}
      onPress={handlePress}
      cursor="pointer"
      hoverStyle={{ opacity: 0.85 }}
      pressStyle={{ opacity: 0.7 }}
      testID="web-account-selector-perps-pill"
    >
      {isEmptyAccount ? (
        <>
          <Icon name="AlignBottomOutline" size="$4" color="$iconOnColor" />
          <SizableText size="$bodyLgMedium" color="$textOnColor">
            {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
          </SizableText>
        </>
      ) : (
        <>
          <Icon name="ChartLine2Outline" size="$4" />
          <PerpsAccountNumberValue
            value={accountValue ?? ''}
            textSize="$bodyLgMedium"
          />
        </>
      )}
    </XStack>
  );
}

function PerpsBalancePill() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <PerpsBalancePillInner />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}

export function WebAccountSelectorTrigger({
  tabRoute,
}: IWebAccountSelectorTriggerProps) {
  const {
    activeAccount: { account, dbAccount, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const address = account?.address
    ? accountUtils.shortenAddress({ address: account.address })
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
      gap="$2"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      role="button"
      testID="web-account-selector-trigger"
    >
      <AccountAvatar
        size="small"
        borderRadius="$full"
        account={account}
        dbAccount={dbAccount}
        indexedAccount={indexedAccount}
      />
      <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
        {address}
      </SizableText>
      {isPerpsRoute ? <PerpsBalancePill /> : null}
    </XStack>
  );

  return <WebAccountPanelPopover renderTrigger={trigger} connected />;
}
