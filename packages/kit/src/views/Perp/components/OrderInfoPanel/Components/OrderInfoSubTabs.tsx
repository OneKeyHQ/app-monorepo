import { ScrollView, SizableText, XStack, YStack } from '@onekeyhq/components';

function OrderInfoSubTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  variant: _variant = 'pill',
}: {
  tabs: {
    key: T;
    label: string;
  }[];
  activeTab: T;
  onChange: (tab: T) => void;
  variant?: 'pill' | 'underline';
}) {
  return (
    <XStack>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        width="100%"
        contentContainerStyle={{ minWidth: '100%' }}
      >
        <XStack
          minWidth="100%"
          pl="$5"
          pr="$5"
          py="$0"
          gap="$5"
          borderBottomWidth="$px"
          borderBottomColor="$borderSubdued"
        >
          {tabs.map((tab) => {
            const isFocused = activeTab === tab.key;
            return (
              <YStack
                key={tab.key}
                h={36}
                onPress={() => onChange(tab.key)}
                position="relative"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                userSelect="none"
              >
                <SizableText
                  numberOfLines={1}
                  size="$bodySmMedium"
                  color={isFocused ? '$text' : '$textSubdued'}
                >
                  {tab.label}
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
          })}
        </XStack>
      </ScrollView>
    </XStack>
  );
}

export { OrderInfoSubTabs };
