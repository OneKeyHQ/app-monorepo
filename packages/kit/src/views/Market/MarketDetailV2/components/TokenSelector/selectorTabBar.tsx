import { useCallback } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

function SelectorTabItem<T extends string>({
  id,
  name,
  isFocused,
  testID,
  onPress,
}: {
  id: T;
  name: string;
  isFocused: boolean;
  testID: string;
  onPress: (id: T) => void;
}) {
  const handlePress = useCallback(() => onPress(id), [id, onPress]);
  return (
    // Figma 27038:46877 / 27047:35021 — a 44px item whose 2px underline is
    // always reserved, so switching tabs never shifts the label.
    <XStack
      testID={testID}
      height={44}
      alignItems="center"
      justifyContent="center"
      borderBottomWidth="$0.5"
      borderBottomColor={isFocused ? '$borderActive' : '$transparent'}
      onPress={handlePress}
      cursor="default"
    >
      <SizableText
        size="$bodyLgMedium"
        color={isFocused ? '$text' : '$textSubdued'}
      >
        {name}
      </SizableText>
    </XStack>
  );
}

/** The underlined tab row shared by the selector's browse and search views. */
export function SelectorTabBar<T extends string>({
  tabs,
  value,
  onChange,
  testIDPrefix,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (tabId: T) => void;
  testIDPrefix: string;
}) {
  return (
    <XStack
      flexShrink={0}
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      bg="$bg"
      px="$5"
      gap="$5"
    >
      {tabs.map((tab) => (
        <SelectorTabItem
          key={tab.id}
          id={tab.id}
          name={tab.label}
          isFocused={value === tab.id}
          testID={`${testIDPrefix}${tab.id}`}
          onPress={onChange}
        />
      ))}
    </XStack>
  );
}
