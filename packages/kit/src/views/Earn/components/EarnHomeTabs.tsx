import { useIntl } from 'react-intl';

import { SizableText, Tabs, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const TabWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <YStack pt="$6" overflow="hidden">
      {children}
    </YStack>
  );
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
  const intl = useIntl();
  const getTabLabel = (name: string) => {
    if (name === 'earn') {
      return intl.formatMessage({ id: ETranslations.earn_title });
    }
    if (name === 'borrow') {
      return intl.formatMessage({ id: ETranslations.global_borrow });
    }
    return name;
  };

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
          return (
            <Tabs.TabBar
              {...tabBarProps}
              divider={false}
              renderItem={({
                name,
                isFocused,
                onPress,
                tabItemStyle,
                focusedTabStyle,
              }) => {
                return (
                  <YStack
                    h={44}
                    ai="center"
                    jc="center"
                    ml={20}
                    key={name}
                    onPress={() => onPress(name)}
                    position="relative"
                    {...tabItemStyle}
                    {...(isFocused ? focusedTabStyle : undefined)}
                  >
                    <SizableText
                      size="$bodyLgMedium"
                      color={isFocused ? '$text' : '$textSubdued'}
                    >
                      {getTabLabel(name)}
                    </SizableText>
                    {isFocused ? (
                      <YStack
                        position="absolute"
                        bottom={0}
                        left={0}
                        right={0}
                        h="$0.5"
                        bg="$text"
                        borderRadius={1}
                      />
                    ) : null}
                  </YStack>
                );
              }}
            />
          );
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
