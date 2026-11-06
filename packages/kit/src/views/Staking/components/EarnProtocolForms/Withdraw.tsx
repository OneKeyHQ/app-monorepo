import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useEtherFiLegacyActionGuard } from '../../hooks/useEtherFiLegacyActionGuard';
import { UniversalWithdraw } from '../UniversalWithdraw';

type ILegacyApprovalProps = {
  onLegacyApprovalCleared?: () => void;
  isLegacyApprovalBlocked?: boolean;
};

type IWithdrawProps = ComponentProps<typeof UniversalWithdraw> &
  ILegacyApprovalProps;

// Queue contracts are bound to their receipt vaults in the EtherFi integration.
const etherFiWithdrawQueues: Record<
  string,
  { address: string; decimals: number }
> = {
  '0xf0bb20865277abd641a307ece5ee04e79073416c': {
    address: '0x0d2df071207e18ca8638b4f04e98c53155ec2ce0',
    decimals: 18,
  },
  '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c': {
    address: '0x38fc1ba73b7ed289955a07d9f11a85b6e388064a',
    decimals: 6,
  },
  '0x5f46d540b6ed704c3c8789105f30e075aa900726': {
    address: '0x77a2fd42f8769d8063f2e75061fc200014e41edf',
    decimals: 8,
  },
};

function isValidEtherFiWithdrawApproval(props: IWithdrawProps) {
  const vault =
    typeof props.protocolVault === 'string'
      ? props.protocolVault.toLowerCase()
      : undefined;
  const expected = vault ? etherFiWithdrawQueues[vault] : undefined;
  const target = props.approveTarget;
  return Boolean(
    expected &&
    vault &&
    props.accountId &&
    props.networkId === getNetworkIdsMap().eth &&
    target?.accountId === props.accountId &&
    target.networkId === props.networkId &&
    typeof target.spenderAddress === 'string' &&
    target.spenderAddress.toLowerCase() === expected.address &&
    typeof target.token?.address === 'string' &&
    target.token?.address.toLowerCase() === vault &&
    target.token.decimals === expected.decimals &&
    target.token.isNative === false,
  );
}

function EtherFiWithdrawForm({
  onLegacyApprovalCleared,
  isLegacyApprovalBlocked,
  ...props
}: IWithdrawProps) {
  const intl = useIntl();
  const invalidApproval =
    props.initialWithdrawType !== 'cancel' &&
    !isValidEtherFiWithdrawApproval(props);
  const actionGuard = useEtherFiLegacyActionGuard({
    accountId: props.accountId ?? '',
    accountAddress: props.accountAddress,
    networkId: props.networkId ?? '',
    vault: props.protocolVault,
    onCleared: onLegacyApprovalCleared,
    skip: props.initialWithdrawType === 'cancel' || isLegacyApprovalBlocked,
  });
  return (
    <UniversalWithdraw
      {...props}
      isDisabled={props.isDisabled || invalidApproval}
      beforeFooter={
        invalidApproval && (!props.isDisabled || props.protocolInfo) ? (
          <>
            {props.beforeFooter}
            <Alert
              type="critical"
              title={intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              })}
            />
          </>
        ) : (
          props.beforeFooter
        )
      }
      actionGuard={actionGuard}
      withdrawalSafetyPolicy="confirm-and-revalidate"
      maxWithdrawAmountMode="fixed"
      showSingleWithdrawPath
    />
  );
}

export function EarnWithdrawForm({
  onLegacyApprovalCleared,
  isLegacyApprovalBlocked,
  ...props
}: IWithdrawProps) {
  if (
    getEarnProtocol(props.providerName ?? '').getLegacyApprovalGuardPolicy() ===
    'etherfi'
  ) {
    return (
      <EtherFiWithdrawForm
        {...props}
        onLegacyApprovalCleared={onLegacyApprovalCleared}
        isLegacyApprovalBlocked={isLegacyApprovalBlocked}
      />
    );
  }
  return <UniversalWithdraw {...props} />;
}
