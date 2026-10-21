import { useState } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';

/**
 * The page's primary tabs (figma 29180-108096): two labels on one baseline,
 * the focused one carrying a 2px underline. Kept deliberately plain — the
 * detail page's swipeable pager is more than this page needs. `bare` leaves
 * the inset and the rule to a row that holds more, the wide layout's.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  testID,
  bare = false,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  testID?: string;
  bare?: boolean;
}) {
  // Subdued until hovered or focused, as the DeFi home's tabs read
  const [hoveredKey, setHoveredKey] = useState<T | undefined>();
  return (
    <XStack
      gap="$5"
      {...(bare
        ? {}
        : {
            px: '$5',
            borderBottomWidth: '$px',
            borderBottomColor: '$borderSubdued',
          })}
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
            onHoverIn={() => setHoveredKey(tab.key)}
            onHoverOut={() =>
              setHoveredKey((key) => (key === tab.key ? undefined : key))
            }
            testID={testID ? `${testID}-${tab.key}` : undefined}
          >
            <SizableText
              size="$bodyLgMedium"
              color={
                focused || hoveredKey === tab.key ? '$text' : '$textSubdued'
              }
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
