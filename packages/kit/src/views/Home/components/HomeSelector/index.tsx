import { memo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { XStack } from '@onekeyhq/components';
import {
  AccountSelectorActiveAccountHome,
  AllNetworksManagerTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerForHome } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';

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
      <AllNetworksManagerTrigger num={num} />
      {!createAddressDisabled ? (
        <AccountSelectorActiveAccountHome num={num} />
      ) : null}
      {!createAddressDisabled ? (
        <DeriveTypeSelectorTriggerForHome num={num} />
      ) : null}
    </XStack>
  );
}

export default memo(HomeSelector);
