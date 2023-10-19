import { Button } from '.';

import type { Meta } from '@storybook/react';

export default {
  title: 'components/Button',
  component: Button,
} satisfies Meta<typeof Button>;

export const Basic = {
  args: {
    buttonVariant: 'primary',
    size: 'medium',
    children: 'hello',
    color: '$textInverse',
  },
};
