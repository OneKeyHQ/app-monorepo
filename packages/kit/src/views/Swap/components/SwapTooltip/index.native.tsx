import type { FC } from 'react';

import { Icon, Pressable, RichTooltip, Text } from '@onekeyhq/components';

import type { SwapTooltipProps } from './types';

const SwapTooltip: FC<SwapTooltipProps> = ({ label }) => (
  <RichTooltip
    // eslint-disable-next-line
    trigger={({ ...props }) => (
      <Pressable {...props}>
        <Icon name="QuestionMarkCircleOutline" size={16} color="icon-subdued" />
      </Pressable>
    )}
    bodyProps={{
      children: <Text>{label}</Text>,
    }}
  />
);

export default SwapTooltip;
