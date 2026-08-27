import { BottomSheetDemo } from '@onekeyhq/components/src/composite/BottomSheet/BottomSheetDemo';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// The BottomSheet is the native half of DialogV2: the content-sized system
// sheet, extracted so other components (a future Popover collapsing to a
// sheet) can present through it too. The demo resolves per platform — the
// real playground on iOS, a stand-in note on web, where the component has
// no counterpart on purpose.

const meta = {
  title: 'Composite/BottomSheet',
  component: BottomSheetDemo,
  args: {
    dismissible: true,
    backgroundInteractive: false,
  },
  argTypes: {
    dismissible: { control: 'boolean' },
    background: { control: 'color' },
    backgroundInteractive: { control: 'boolean' },
    snapPoints: {
      control: 'select',
      options: ['content-sized', 'half', 'half-and-full', 'two-heights'],
      mapping: {
        'content-sized': undefined,
        half: ['half'],
        'half-and-full': ['half', 'full'],
        'two-heights': [{ height: 300 }, { height: 560 }],
      },
    },
  },
} satisfies Meta<typeof BottomSheetDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Every prop on one stage: toggle `dismissible` (drag, backdrop and the
 * grabber all follow), paint `background` over the system material, flip
 * `backgroundInteractive` to keep the app behind the sheet pressable —
 * and use Grow/Shrink inside the sheet to watch the height follow the
 * content through the system's own detent animation. `snapPoints`
 * switches the height model: content-sized is only the default, and any
 * explicit choice hands the height to the caller — the sheet rests at
 * the given stops and drags between them, while Grow/Shrink stop
 * mattering. With `dismissible` off, Close inside the sheet is the only
 * way out.
 */
export const Playground: Story = {};
