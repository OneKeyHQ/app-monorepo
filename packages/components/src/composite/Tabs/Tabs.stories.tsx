import { Tabs } from '@onekeyhq/components/src/composite/Tabs';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const POSITIONS = [
  'BTC · 0.5214 · $33,041.20',
  'ETH · 4.2001 · $14,613.55',
  'SOL · 120.55 · $19,858.02',
  'DOGE · 15,000 · $3,120.00',
  'TON · 890.12 · $6,401.86',
] as const;

const HISTORY = [
  'Sent 0.05 BTC · Jul 10',
  'Received 1.2 ETH · Jul 8',
  'Swapped SOL → USDC · Jul 6',
  'Approved USDT · Jul 2',
] as const;

const ABOUT = [
  'Multi-chain wallet portfolio.',
  'Tabs share one scroll container.',
  'The header collapses on scroll.',
] as const;

// Long enough to overflow the 420px container — without real scroll distance
// the collapsible header never moves.
const LONG_POSITIONS = Array.from(
  { length: 24 },
  (_, i) =>
    `Token #${i + 1} · ${((24 - i) * 0.37).toFixed(2)} · $${(24 - i) * 412}.00`,
);

function TabContent({ rows }: { rows: readonly string[] }) {
  return (
    <Tabs.ScrollView>
      <YStack px="$4" py="$3" gap="$3">
        {rows.map((row) => (
          <SizableText key={row} size="$bodyMd">
            {row}
          </SizableText>
        ))}
      </YStack>
    </Tabs.ScrollView>
  );
}

function renderBalanceHeader() {
  return (
    <YStack px="$4" py="$5" bg="$bgApp" pointerEvents="none">
      <SizableText size="$bodySm" color="$textSubdued">
        Total balance
      </SizableText>
      <SizableText size="$heading3xl">$77,034.63</SizableText>
    </YStack>
  );
}

// Tabs wraps react-native-collapsible-tab-view on native and rebuilds the
// same API on web: Container + Tab(name) + Tabs.ScrollView/List content that
// shares one scroll and collapses renderHeader. The demo bounds it in a
// fixed-height YStack — in the app it fills a screen (Market/Home). It exists
// because Tabs.Container requires children, which CSF would demand as args.
function TabsDemo({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <YStack h={420}>
      <Tabs.Container
        renderHeader={withHeader ? renderBalanceHeader : undefined}
      >
        <Tabs.Tab name="Positions">
          <TabContent rows={withHeader ? LONG_POSITIONS : POSITIONS} />
        </Tabs.Tab>
        <Tabs.Tab name="History">
          <TabContent rows={HISTORY} />
        </Tabs.Tab>
        <Tabs.Tab name="About">
          <TabContent rows={ABOUT} />
        </Tabs.Tab>
      </Tabs.Container>
    </YStack>
  );
}

const meta = {
  title: 'Composite/Tabs',
  component: TabsDemo,
} satisfies Meta<typeof TabsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// Scroll the tab content to see the header collapse behind the tab bar
// (the Positions list is long enough to actually scroll here).
export const CollapsibleHeader: Story = {
  args: {
    withHeader: true,
  },
};
