import { Button } from './Button';

export default {
  title: 'Button',
  component: Button,
  argTypes: {
    onPress: { action: 'onPress' },
  },
};

export const Base = {
  args: { text: 'Hello World' },
};
