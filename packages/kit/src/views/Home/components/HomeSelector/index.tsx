import { memo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { XStack } from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';

type IProps = { createAddressDisabled?: boolean } & IXStackProps;

function HomeSelector(props: IProps) {
  const num = 0;
  const { createAddressDisabled, ...rest } = props;
  return (
    <XStack
      testID="Wallet-Address-Generator"
      alignItems="center"
      gap="$3"
      {...rest}
    >
      <NetworkSelectorTriggerHome num={num} recordNetworkHistoryEnabled />
      {!createAddressDisabled ? (
        <AccountSelectorActiveAccountHome num={num} />
      ) : null}
      {/* {!createAddressDisabled ? (
        <DeriveTypeSelectorTriggerForHome num={num} />
      ) : null} */}
    </XStack>
  );
}

export default memo(HomeSelector);
