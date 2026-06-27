import { ScrollView, SizableText, XStack, YStack } from '@onekeyhq/components';

function OrderInfoSubTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  variant: _variant = 'underline',
}: {
  tabs: {
    key: T;
    label: string;
  }[];
  activeTab: T;
  onChange: (tab: T) => void;
  variant?: 'pill' | 'underline';
}) {
  const isPillVariant = _variant === 'pill';

  return (
    <XStack mt={isPillVariant ? '$2' : undefined}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        width="100%"
        contentContainerStyle={{
          minWidth: isPillVariant ? undefined : '100%',
        }}
      >
        <XStack
          minWidth={isPillVariant ? undefined : '100%'}
          pl={isPillVariant ? '$2' : '$5'}
          pr={isPillVariant ? '$4' : '$5'}
          py={isPillVariant ? '$1.5' : '$0'}
          gap={isPillVariant ? '$2' : '$5'}
          borderBottomWidth={isPillVariant ? 0 : '$px'}
          borderBottomColor="$borderSubdued"
        >
          {tabs.map((tab) => {
            const isFocused = activeTab === tab.key;
            const pillBg = (() => {
              if (!isPillVariant) {
                return undefined;
              }
              return isFocused ? '$bgActive' : 'transparent';
            })();
            return (
              <YStack
                key={tab.key}
                h={isPillVariant ? undefined : 36}
                px={isPillVariant ? '$2' : '$0'}
                py={isPillVariant ? '$1' : '$0'}
                onPress={() => onChange(tab.key)}
                position="relative"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                userSelect="none"
                borderRadius={isPillVariant ? '$4' : undefined}
                bg={pillBg}
                {...(isPillVariant && !isFocused
                  ? {
                      hoverStyle: {
                        bg: '$bgStrongHover',
                      },
                      pressStyle: {
                        bg: '$bgStrongActive',
                      },
                    }
                  : undefined)}
              >
                <SizableText
                  numberOfLines={1}
                  size={isPillVariant ? '$bodySmMedium' : '$bodySmMedium'}
                  color={isFocused ? '$text' : '$textSubdued'}
                >
                  {tab.label}
                </SizableText>
                {!isPillVariant && isFocused ? (
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
