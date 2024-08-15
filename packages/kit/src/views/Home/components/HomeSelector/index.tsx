import { memo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerForHome } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IProps = { createAddressDisabled?: boolean } & IXStackProps;

function HomeSelector(props: IProps) {
  const media = useMedia();
  const num = 0;
  const { createAddressDisabled, ...rest } = props;
  return (
    <XStack
      testID="Wallet-Address-Generator"
      alignItems="center"
      gap="$3"
      {...rest}
    >
      <NetworkSelectorTriggerHome num={num} />
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
