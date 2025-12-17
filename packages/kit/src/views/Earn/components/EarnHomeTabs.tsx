import { Tabs, YStack } from '@onekeyhq/components';

const TabWrapper = ({ children }: { children: React.ReactNode }) => {
  return <YStack pt="$6">{children}</YStack>;
};

export const EarnHomeTabs = ({
  earn,
  borrow,
  defaultMode,
  onModeChange,
}: {
  earn: React.ReactNode;
  borrow: React.ReactNode;
  defaultMode?: 'earn' | 'borrow';
  onModeChange?: (mode: 'earn' | 'borrow') => void;
}) => {
  // FIXME[borrow]: earn/borrow i18n
  return (
    <YStack pt="$2">
      <Tabs.Container
        initialTabName={defaultMode || 'earn'}
        onTabChange={({ tabName }) => {
          if (tabName === 'earn' || tabName === 'borrow') {
            onModeChange?.(tabName);
          }
        }}
        renderTabBar={(tabBarProps) => {
          return <Tabs.TabBar {...tabBarProps} divider={false} />;
        }}
      >
        <Tabs.Tab name="earn">
          <Tabs.ScrollView>
            <TabWrapper>{earn}</TabWrapper>
          </Tabs.ScrollView>
        </Tabs.Tab>
        <Tabs.Tab name="borrow">
          <Tabs.ScrollView>
            <TabWrapper>{borrow}</TabWrapper>
          </Tabs.ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
    </YStack>
  );
};
