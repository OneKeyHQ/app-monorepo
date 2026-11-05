import type { ComponentProps } from 'react';

import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';

import { useEtherFiLegacyActionGuard } from '../../hooks/useEtherFiLegacyActionGuard';
import { UniversalStake } from '../UniversalStake';

type ILegacyApprovalProps = {
  onLegacyApprovalCleared?: () => void;
  isLegacyApprovalBlocked?: boolean;
};

type IStakeProps = ComponentProps<typeof UniversalStake> & ILegacyApprovalProps;

function EtherFiStakeForm({
  onLegacyApprovalCleared,
  isLegacyApprovalBlocked,
  ...props
}: IStakeProps) {
  const actionGuard = useEtherFiLegacyActionGuard({
    accountId: props.accountId,
    accountAddress:
      props.protocolInfo?.earnAccount?.accountId === props.accountId &&
      props.protocolInfo.earnAccount.networkId === props.networkId
        ? props.protocolInfo.earnAccount.accountAddress
        : undefined,
    networkId: props.networkId,
    vault: props.protocolInfo?.vault,
    onCleared: onLegacyApprovalCleared,
    skip: isLegacyApprovalBlocked,
  });
  return (
    <UniversalStake
      {...props}
      actionGuard={actionGuard}
      preparationPolicy="confirm-setup-before-deposit"
    />
  );
}

export function EarnStakeForm({
  onLegacyApprovalCleared,
  isLegacyApprovalBlocked,
  ...props
}: IStakeProps) {
  if (
    getEarnProtocol(props.providerName ?? '').getLegacyApprovalGuardPolicy() ===
    'etherfi'
  ) {
    return (
      <EtherFiStakeForm
        {...props}
        onLegacyApprovalCleared={onLegacyApprovalCleared}
        isLegacyApprovalBlocked={isLegacyApprovalBlocked}
      />
    );
  }
  return <UniversalStake {...props} />;
}
