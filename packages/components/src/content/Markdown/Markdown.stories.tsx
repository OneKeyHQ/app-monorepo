import { Markdown } from '@onekeyhq/components/src/content/Markdown';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Mirrors the app's main Markdown use: release notes rendering (What's New).
// The component's custom rules restyle headings, bullets, and ordered lists
// with tamagui text primitives.
const CHANGELOG = `# OneKey 5.12
## Highlights
- Hardware wallet firmware update flow
- Faster swap quotes with **auto refresh**
- New market watchlist widgets
## Fixes
1. Restore Lightning invoice parsing
2. Correct fiat rounding on small balances
3. Stop duplicate approval prompts
`;

const meta = {
  title: 'Content/Markdown',
  component: Markdown,
  args: {
    children: CHANGELOG,
  },
} satisfies Meta<typeof Markdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
