import { FC } from 'react';

import { HStack } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../../hooks';

import { AccountSelectorTrigger } from './AccountSelectorTrigger';
import { INetworkAccountSelectorTriggerProps } from './BaseSelectorTrigger';
import { NetworkSelectorTrigger } from './NetworkSelectorTrigger';

const defaultProps = {
  size: 'sm',
  type: 'plain',
} as const;

const NetworkAccountSelectorTrigger: FC<
  INetworkAccountSelectorTriggerProps
> = ({ size, type, bg, mode }) => {
  const { wallet } = useActiveWalletAccount();

  if (!wallet) {
    return null;
  }

  return (
    <HStack space={2} alignItems="center">
      <NetworkSelectorTrigger size={size} type={type} bg={bg} mode={mode} />
      <AccountSelectorTrigger size={size} type={type} bg={bg} mode={mode} />
    </HStack>
  );
};

NetworkAccountSelectorTrigger.defaultProps = defaultProps;

function NetworkAccountSelectorTriggerDesktop(
  props: INetworkAccountSelectorTriggerProps,
) {
  return <NetworkAccountSelectorTrigger size="lg" type="plain" {...props} />;
}

function NetworkAccountSelectorTriggerMobile(
  props: INetworkAccountSelectorTriggerProps,
) {
  return <NetworkAccountSelectorTrigger size="sm" type="basic" {...props} />;
}

export {
  NetworkAccountSelectorTrigger,
  NetworkAccountSelectorTriggerDesktop,
  NetworkAccountSelectorTriggerMobile,
};
