import { XStack, useIsHorizontalLayout } from '@onekeyhq/components';

import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import {
  AccountSelectorActiveAccountHome,
  NetworkSelectorTriggerHome,
} from '../AccountSelector';

export function UrlAccountPageHeader() {
  const isHorizontal = useIsHorizontalLayout();

  return (
    <XStack gap="$2.5" ai="center">
      <UrlAccountNavHeader.Address key="urlAccountNavHeaderAddress" />
      {isHorizontal ? (
        <NetworkSelectorTriggerHome
          num={0}
          recordNetworkHistoryEnabled
          hideOnNoAccount
        />
      ) : null}
      <AccountSelectorActiveAccountHome
        num={0}
        showAccountAddress={false}
        showCopyButton
        showCreateAddressButton={false}
        showNoAddressTip={false}
      />
    </XStack>
  );
}
