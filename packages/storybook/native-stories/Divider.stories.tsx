import { Divider } from '@onekeyhq/components/src/Divider';

import type { Meta } from '@storybook/react';

export default {
  title: 'components/Divider',
  component: Divider,
} satisfies Meta<typeof Divider>;

export const Render = {
  render: () => <Divider />,
};
