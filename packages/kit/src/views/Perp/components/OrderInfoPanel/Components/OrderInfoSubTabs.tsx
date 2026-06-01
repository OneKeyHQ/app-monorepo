import { ScrollView, SizableText, XStack } from '@onekeyhq/components';

function OrderInfoSubTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  variant = 'pill',
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
          pl={variant === 'underline' ? '$5' : '$2.5'}
          pr="$5"
          py={variant === 'underline' ? '$0' : '$2.5'}
          gap={variant === 'underline' ? '$5' : '$2'}
          borderBottomWidth={variant === 'underline' ? '$px' : '$0'}
          borderBottomColor="$borderSubdued"
        >
          {tabs.map((tab) => {
            const isFocused = activeTab === tab.key;
            return (
              <XStack
                key={tab.key}
                alignItems="center"
                justifyContent="center"
                px={variant === 'underline' ? '$0' : '$2.5'}
                py={variant === 'underline' ? '$2.5' : '$1.5'}
                borderRadius={variant === 'underline' ? '$0' : '$full'}
                userSelect="none"
                cursor="pointer"
                backgroundColor={
                  variant === 'pill' && isFocused ? '$bgActive' : '$transparent'
                }
                borderBottomWidth={
                  variant === 'underline' && isFocused ? '$px' : '$0'
                }
                borderBottomColor="$borderActive"
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
