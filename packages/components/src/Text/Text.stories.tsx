import { Text } from '.';

import type { Meta } from '@storybook/react';

export default {
  title: 'components/Text',
  component: Text,
} satisfies Meta<typeof Text>;

export const Basic = {
  args: {
    children: 'Hello',
    name: 'word',
    variant: '$bodyLgMedium',
  },
};

export const Render = {
  render: () => <Text variant="$bodyLgMedium">Render</Text>,
};
