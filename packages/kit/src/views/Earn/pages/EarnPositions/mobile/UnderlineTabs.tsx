import { SizableText, XStack, YStack } from '@onekeyhq/components';

/**
 * The page's primary tabs (figma 29180-108096): two labels on one baseline,
 * the focused one carrying a 2px underline. Kept deliberately plain — the
 * detail page's swipeable pager is more than this page needs.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  testID,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  testID?: string;
}) {
  return (
    <XStack
      px="$5"
      gap="$5"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      testID={testID}
    >
      {tabs.map((tab) => {
        const focused = tab.key === value;
        return (
          <YStack
            key={tab.key}
            pt="$3"
            pb="$2.5"
            borderBottomWidth={2}
            borderBottomColor={focused ? '$text' : 'transparent'}
            cursor="pointer"
            userSelect="none"
            onPress={() => onChange(tab.key)}
            testID={testID ? `${testID}-${tab.key}` : undefined}
          >
            <SizableText
              size="$bodyLgMedium"
              color={focused ? '$text' : '$textSubdued'}
              numberOfLines={1}
            >
              {tab.label}
            </SizableText>
          </YStack>
        );
      })}
    </XStack>
  );
}
