import type { ReactNode } from 'react';

import { Popover, SizableText, Tooltip, YStack } from '@onekeyhq/components';
import type { IPopoverProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IChainSelectorTooltipProps = {
  renderTrigger: ReactNode;
  renderContent: string;
  placement?: IPopoverProps['placement'];
};

function ChainSelectorTooltip({
  renderTrigger,
  renderContent,
  placement = 'bottom-start',
}: IChainSelectorTooltipProps) {
  if (platformEnv.isNative) {
    return (
      <Popover
        title=""
        showHeader={false}
        placement={placement}
        renderTrigger={renderTrigger}
        renderContent={
          <YStack p="$5">
            <SizableText size="$bodyLg">{renderContent}</SizableText>
          </YStack>
        }
      />
    );
  }

  return (
    <Tooltip
      placement={placement}
      renderTrigger={renderTrigger}
      renderContent={renderContent}
    />
  );
}

export default ChainSelectorTooltip;
