import type { FC } from 'react';

import { HStack, useIsVerticalLayout } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../../hooks';

import { AccountSelectorTrigger } from './AccountSelectorTrigger';
import { NetworkSelectorTrigger } from './NetworkSelectorTrigger';

import type { INetworkAccountSelectorTriggerProps } from './BaseSelectorTrigger';

const NetworkAccountSelectorTrigger: FC<
  INetworkAccountSelectorTriggerProps
> = ({ type = 'plain', bg, mode, iconSize, labelTypography }) => {
  const { wallet } = useActiveWalletAccount();
  const isVerticalLayout = useIsVerticalLayout();

  if (!wallet) {
    return null;
  }

  return (
    <HStack space={2} alignItems="center">
      <NetworkSelectorTrigger
        iconSize={iconSize}
        type={type}
        bg={bg}
        mode={mode}
        showName={!isVerticalLayout}
      />
      <AccountSelectorTrigger
        type={type}
        bg={bg}
        mode={mode}
        labelTypography={labelTypography}
        showAddress={!isVerticalLayout}
      />
    </HStack>
  );
};

function NetworkAccountSelectorTriggerDesktop(
  props: INetworkAccountSelectorTriggerProps,
) {
  return <NetworkAccountSelectorTrigger type="plain" {...props} />;
}

function NetworkAccountSelectorTriggerMobile(
  props: INetworkAccountSelectorTriggerProps,
) {
  return <NetworkAccountSelectorTrigger type="basic" {...props} />;
}

export {
  NetworkAccountSelectorTrigger,
  NetworkAccountSelectorTriggerDesktop,
  NetworkAccountSelectorTriggerMobile,
};
