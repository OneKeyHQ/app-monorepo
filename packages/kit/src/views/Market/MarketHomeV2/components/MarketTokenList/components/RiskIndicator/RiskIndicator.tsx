import type { FC } from 'react';

import { Popover, Stack } from '@onekeyhq/components';

import { RiskIndicatorCard } from './RiskIndicatorCard';
import { RiskIndicatorIcon } from './RiskIndicatorIcon';
import { useRiskIndicator } from './useRiskIndicator';

import type { IRiskIndicatorType } from './useRiskIndicator';

export interface IRiskIndicatorProps {
  type: IRiskIndicatorType;
}

// This component renders a risk indicator icon and shows a rich card inside
// a Popover when the icon is pressed / hovered. It combines the previously
// separate RiskIndicatorIcon and RiskIndicatorCard components into a single
// easy-to-use element.
export const RiskIndicator: FC<IRiskIndicatorProps> = ({ type }) => {
  const config = useRiskIndicator(type);

  return (
    <Popover
      // Display the card on the right side of the icon to avoid covering the
      // table cell. The caller can always override this via Popover props once
      // needed, but for now this is sufficient for the Market table.
      placement="right"
      // Hide the built-in header. We already display a custom title inside the
      // card itself.
      showHeader={false}
      title=""
      // Icon acts as the trigger element.
      renderTrigger={
        <Stack cursor="pointer">
          <RiskIndicatorIcon type={type} />
        </Stack>
      }
      // Render the full card inside the popover.
      renderContent={
        <RiskIndicatorCard
          type={type}
          title={config.cardTitle}
          description={config.cardDescription}
        />
      }
    />
  );
};
