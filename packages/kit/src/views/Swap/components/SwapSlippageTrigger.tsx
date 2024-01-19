import { memo } from 'react';

import { ActionList, IconButton } from '@onekeyhq/components';

interface ISwapSlippageTriggerProps {
  onOpenSlippageModal: () => void;
}
const SwapSlippageTrigger = ({
  onOpenSlippageModal,
}: ISwapSlippageTriggerProps) => (
  <ActionList
    title=""
    renderTrigger={<IconButton icon="MoreIllus" />}
    items={[{ label: 'Slippage', onPress: onOpenSlippageModal }]}
  />
);

export default memo(SwapSlippageTrigger);
