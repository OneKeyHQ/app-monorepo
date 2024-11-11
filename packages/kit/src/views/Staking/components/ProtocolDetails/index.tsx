import type { PropsWithChildren } from 'react';

import { Divider, YStack } from '@onekeyhq/components';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import { FaqSection } from './FaqSection';
import { ProfitSection } from './ProfitSection';
import { ProviderSection } from './ProviderSection';

type IProtocolDetailsProps = {
  details?: IStakeProtocolDetails;
};

export function ProtocolDetails({
  details,
  children,
}: PropsWithChildren<IProtocolDetailsProps>) {
  if (!details) {
    return null;
  }
  return (
    <>
      <YStack gap="$8">{children}</YStack>
      <ProfitSection details={details} />
      <Divider />
      <ProviderSection details={details} />
      <Divider />
      <FaqSection details={details} />
    </>
  );
}
