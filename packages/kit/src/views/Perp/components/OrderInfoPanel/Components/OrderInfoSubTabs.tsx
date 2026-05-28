import { ScrollView, SizableText, XStack } from '@onekeyhq/components';

function OrderInfoSubTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: {
    key: T;
    label: string;
  }[];
  activeTab: T;
  onChange: (tab: T) => void;
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
        <XStack minWidth="100%" pl="$2.5" pr="$5" py="$2.5" gap="$2">
          {tabs.map((tab) => {
            const isFocused = activeTab === tab.key;
            return (
              <XStack
                key={tab.key}
                alignItems="center"
                justifyContent="center"
                px="$2.5"
                py="$1.5"
                borderRadius="$full"
                userSelect="none"
                cursor="pointer"
                backgroundColor={isFocused ? '$bgActive' : '$transparent'}
                onPress={() => onChange(tab.key)}
              >
                <SizableText
                  numberOfLines={1}
                  size="$bodySmMedium"
                  color={isFocused ? '$text' : '$textSubdued'}
                >
                  {tab.label}
                </SizableText>
              </XStack>
            );
          })}
        </XStack>
      </ScrollView>
    </XStack>
  );
}

export { OrderInfoSubTabs };
