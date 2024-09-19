import type { ComponentProps } from 'react';

import type { Button } from '@onekeyhq/components';
import { Divider } from '@onekeyhq/components';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import { FaqSection } from './FaqSection';
import { NoAddressWarning } from './NoAddressWarning';
import { PortfolioSection } from './PortfolioSection';
import { ProfitSection } from './ProfitSection';
import { ProviderSection } from './ProviderSection';
import { StakedValueSection } from './StakedValueSection';

type IProtocolDetailsProps = {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  earnAccount?:
    | {
        accountId: string;
        networkId: string;
        accountAddress: string;
        account: INetworkAccount;
      }
    | null
    | undefined;
  details?: IStakeProtocolDetails;
  onClaim?: () => void;
  onWithdraw?: () => void;
  onPortfolioDetails?: () => void;
  onCreateAddress: () => void;
  stakeButtonProps?: ComponentProps<typeof Button>;
  withdrawButtonProps?: ComponentProps<typeof Button>;
};

export function ProtocolDetails({
  accountId,
  networkId,
  indexedAccountId,
  earnAccount,
  details,
  onClaim,
  onWithdraw,
  onPortfolioDetails,
  onCreateAddress,
  stakeButtonProps,
  withdrawButtonProps,
}: IProtocolDetailsProps) {
  if (!details) {
    return null;
  }
  return (
    <>
      {earnAccount?.accountAddress ? (
        <>
          <StakedValueSection
            details={details}
            stakeButtonProps={stakeButtonProps}
            withdrawButtonProps={withdrawButtonProps}
          />
          <PortfolioSection
            details={details}
            onClaim={onClaim}
            onWithdraw={onWithdraw}
            onPortfolioDetails={onPortfolioDetails}
          />
        </>
      ) : (
        <NoAddressWarning
          accountId={accountId}
          networkId={networkId}
          indexedAccountId={indexedAccountId}
          onCreateAddress={onCreateAddress}
        />
      )}
      <Divider />
      <ProfitSection details={details} />
      <Divider />
      <ProviderSection details={details} />
      <Divider />
      <FaqSection details={details} />
    </>
  );
}
