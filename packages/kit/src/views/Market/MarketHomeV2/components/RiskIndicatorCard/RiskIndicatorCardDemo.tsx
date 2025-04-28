import { Stack, XStack } from '@onekeyhq/components';

import { RiskIndicatorCard } from './RiskIndicatorCard';

export const RiskIndicatorCardDemo = () => (
  <XStack gap="$4">
    <RiskIndicatorCard
      type="unknown"
      title="Unknown risk"
      description="Unable to conduct risk audit for this token. Beware of potential trading risks."
    />
    <RiskIndicatorCard
      type="safe"
      title="Safe"
      description="No risks detected. This result does not constitute any form of endorsement or recommendation."
    />
    <RiskIndicatorCard
      type="danger"
      title="Danger"
      description="Trading risk has been detected. Please proceed with caution."
    />
    <RiskIndicatorCard
      type="info"
      title="Market Cap"
      description="market cp is...."
    />
  </XStack>
);

export default RiskIndicatorCardDemo;
