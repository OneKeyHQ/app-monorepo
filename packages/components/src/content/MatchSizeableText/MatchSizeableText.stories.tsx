import { MatchSizeableText } from '@onekeyhq/components/src/content/MatchSizeableText';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Fuse.js-style search hit: `indices` are inclusive [start, end] pairs into
// the children string.
const SINGLE_MATCH: IFuseResultMatch = {
  indices: [[0, 3]],
};

// The component highlights only the BEST range (longest, then earliest):
// 'Mainnet' [9, 15] wins over the shorter [0, 3] prefix range here.
const MULTI_MATCH: IFuseResultMatch = {
  indices: [
    [0, 3],
    [9, 15],
  ],
};

const SUCCESS_MATCH_STYLE = {
  color: '$textSuccess',
} as const;

const meta = {
  title: 'Content/MatchSizeableText',
  component: MatchSizeableText,
  args: {
    children: 'Ethereum Mainnet',
    match: SINGLE_MATCH,
    size: '$bodyLg',
  },
} satisfies Meta<typeof MatchSizeableText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const BestMatchOnly: Story = {
  args: {
    match: MULTI_MATCH,
  },
};

export const CustomHighlight: Story = {
  args: {
    matchTextStyle: SUCCESS_MATCH_STYLE,
  },
};
