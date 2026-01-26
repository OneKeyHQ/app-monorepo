import {
  XStack,
  useIsWebHorizontalLayout,
  useMedia,
} from '@onekeyhq/components';

import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import {
  AccountSelectorActiveAccountHome,
  NetworkSelectorTriggerHome,
} from '../AccountSelector';

export function UrlAccountPageHeader() {
  const isHorizontal = useIsWebHorizontalLayout();
  const { gtMd } = useMedia();

  return (
    <XStack gap="$2.5" ai="center" flexShrink={1} minWidth={0}>
      <UrlAccountNavHeader.Address
        key="urlAccountNavHeaderAddress"
        enableCopy={!gtMd}
      />
      {isHorizontal ? (
        <NetworkSelectorTriggerHome
          num={0}
          recordNetworkHistoryEnabled
          hideOnNoAccount
        />
      ) : null}
      {gtMd ? (
        <AccountSelectorActiveAccountHome
          num={0}
          showAccountAddress={false}
          showCopyButton
          showCreateAddressButton={false}
          showNoAddressTip={false}
        />
      ) : null}
    </XStack>
  );
}
