import { FC } from 'react';

import { HStack, useIsVerticalLayout } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../../hooks';

import { AccountSelectorTrigger } from './AccountSelectorTrigger';
import { INetworkAccountSelectorTriggerProps } from './BaseSelectorTrigger';
import { NetworkSelectorTrigger } from './NetworkSelectorTrigger';

const defaultProps = {
  type: 'plain',
} as const;

const NetworkAccountSelectorTrigger: FC<
  INetworkAccountSelectorTriggerProps
> = ({ type, bg, mode }) => {
  const { wallet } = useActiveWalletAccount();
  const isVerticalLayout = useIsVerticalLayout();

  if (!wallet) {
    return null;
  }

  return (
    <HStack space={2} alignItems="center">
      <NetworkSelectorTrigger
        type={type}
        bg={bg}
        mode={mode}
        showName={!isVerticalLayout}
      />
      <AccountSelectorTrigger
        type={type}
        bg={bg}
        mode={mode}
        showAddress={!isVerticalLayout}
      />
    </HStack>
  );
};

NetworkAccountSelectorTrigger.defaultProps = defaultProps;

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
