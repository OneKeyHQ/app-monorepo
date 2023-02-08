import type { FC } from 'react';

import { Icon, Pressable, Tooltip } from '@onekeyhq/components';

import type { SwapTooltipProps } from './types';

const SwapTooltip: FC<SwapTooltipProps> = ({ label }) => (
  <Tooltip hasArrow _text={{ maxW: '80' }} label={label} placement="top">
    <Pressable
      borderRadius="full"
      p="2px"
      position="relative"
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
    >
      <Icon color="text-subdued" name="QuestionMarkCircleOutline" size={16} />
    </Pressable>
  </Tooltip>
);

export default SwapTooltip;
