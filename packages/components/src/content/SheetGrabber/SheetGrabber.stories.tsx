import { SheetGrabber } from '@onekeyhq/components/src/content/SheetGrabber';
import { Stack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Drag handle pinned to the top of its parent (position="absolute"),
// so the decorator provides the sheet-like container the same way
// Dialog mounts it above sheet content.
const meta = {
  title: 'Content/SheetGrabber',
  component: SheetGrabber,
  decorators: [
    (Story) => (
      <Stack
        w={320}
        h={96}
        bg="$bgSubdued"
        borderTopLeftRadius="$4"
        borderTopRightRadius="$4"
      >
        <Story />
      </Stack>
    ),
  ],
} satisfies Meta<typeof SheetGrabber>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
