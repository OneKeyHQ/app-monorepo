import { memo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { XStack } from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';

type IProps = IXStackProps;

function HomeSelector(props: IProps) {
  const num = 0;

  return (
    <XStack
      testID="Wallet-Address-Generator"
      alignItems="center"
      space="$3"
      {...props}
    >
      <NetworkSelectorTriggerHome num={num} />
      <AccountSelectorActiveAccountHome num={num} />
      <DeriveTypeSelectorTrigger miniMode num={num} />
    </XStack>
  );
}

export default memo(HomeSelector);
