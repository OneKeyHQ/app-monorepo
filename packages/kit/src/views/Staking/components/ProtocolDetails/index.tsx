import type { PropsWithChildren } from 'react';

import { Divider, YStack } from '@onekeyhq/components';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import { FaqSection } from './FaqSection';
import { PeriodSection } from './PeriodSection';
import { ProfitSection } from './ProfitSection';
import { ProtectionSection } from './ProtectionSection';
import { ProviderSection } from './ProviderSection';
import { RiskSection } from './RiskSection';

type IProtocolDetailsProps = {
  details?: IStakeProtocolDetails;
  symbol: string;
};

/** 组装旧版详情分区，入口 symbol 独立传给 FAQ；详情尚未加载时不渲染或触发子查询。 */
export function ProtocolDetails({
  details,
  symbol,
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
      <ProtectionSection details={details} />
      <PeriodSection details={details} />
      <ProviderSection details={details} />
      <Divider />
      <RiskSection details={details} />
      <FaqSection details={details} symbol={symbol} />
    </>
  );
}
