import { useCallback, useState } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { SizableText, XStack, YStack } from '@onekeyhq/components';

import { buildKeyboardPressProps } from '../../../components/desktopHome/earnDesktopPressable';

// The selected tab's line slides to the next one, as the DeFi home's tabs do
const TAB_LINE_TRANSITION = ['smooth', { duration: 220 }] as [
  'smooth',
  { duration: number },
];
const TAB_LINE_ANIMATE_ONLY = ['transform', 'width'];

type ITabPlace = { x: number; width: number };

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
  const reduceMotion = useReducedMotion();
  const [places, setPlaces] = useState<Record<string, ITabPlace>>({});
  const handlePlace = useCallback((key: T, place: ITabPlace) => {
    setPlaces((prev) =>
      prev[key]?.x === place.x && prev[key]?.width === place.width
        ? prev
        : { ...prev, [key]: place },
    );
  }, []);
  // Once every tab is measured; until then each draws its own border
  const line = tabs.every((tab) => places[tab.key]) ? places[value] : undefined;
  return (
    <XStack
      gap="$5"
      role="tablist"
      position="relative"
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
        const select = () => onChange(tab.key);
        return (
          <YStack
            key={tab.key}
            role="tab"
            aria-selected={focused}
            pt="$3"
            pb="$2.5"
            borderBottomWidth={2}
            borderBottomColor={focused && !line ? '$text' : 'transparent'}
            cursor="pointer"
            userSelect="none"
            onPress={select}
            onHoverIn={() => setHoveredKey(tab.key)}
            onHoverOut={() =>
              setHoveredKey((key) => (key === tab.key ? undefined : key))
            }
            onLayout={(event) =>
              handlePlace(tab.key, {
                x: event.nativeEvent.layout.x,
                width: event.nativeEvent.layout.width,
              })
            }
            testID={testID ? `${testID}-${tab.key}` : undefined}
            {...buildKeyboardPressProps(select, 2)}
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
      {line ? (
        <YStack
          position="absolute"
          left={0}
          bottom={0}
          h={2}
          borderRadius={1}
          bg="$text"
          width={line.width}
          x={line.x}
          pointerEvents="none"
          transition={reduceMotion ? undefined : TAB_LINE_TRANSITION}
          animateOnly={TAB_LINE_ANIMATE_ONLY}
        />
      ) : null}
    </XStack>
  );
}
