import { useMemo } from 'react';

import { StyleSheet } from 'react-native';
import { Adapt, Sheet, Select as TMSelect, useMedia } from 'tamagui';
import { LinearGradient } from 'tamagui/linear-gradient';

import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { XStack, YStack } from '../Stack';
import { Text } from '../Text';

import type { SheetProps, SelectProps as TMSelectProps } from 'tamagui';

interface SelectProps extends TMSelectProps {
  data: Array<{ name: string | number }>;
  snapPointsMode?: SheetProps['snapPointsMode'];
  title: string;
}

function Select({
  data,
  snapPointsMode,
  title = 'Title',
  ...props
}: SelectProps) {
  const { bottom } = useSafeAreaInsets();
  const media = useMedia();

  return (
    <TMSelect {...props} disablePreventBodyScroll>
      <TMSelect.Trigger
        unstyled
        borderRadius="$2"
        borderColor="$borderStrong"
        borderWidth="$px"
        paddingLeft="$3"
        paddingRight="$2"
        paddingVertical="$1.5"
        backgroundColor="$transparent"
        width="$56"
        minHeight="auto"
      >
        <TMSelect.Value
          placeholder="Something"
          unstyled
          fontSize="$bodyLg"
          fontWeight="$bodyLg"
        />
        <XStack>
          <Icon color="$iconSubdued" name="ChevronDownSmallOutline" size="$5" />
        </XStack>
      </TMSelect.Trigger>
      <Adapt when="md">
        <Sheet
          modal
          dismissOnSnapToBottom
          animation="quick"
          snapPointsMode={snapPointsMode}
        >
          <Sheet.Frame unstyled>
            <>
              <XStack
                borderTopLeftRadius="$6"
                borderTopRightRadius="$6"
                backgroundColor="$bg"
                marginHorizontal="$5"
                paddingHorizontal="$5"
                paddingVertical="$4"
                justifyContent="space-between"
                borderBottomWidth={StyleSheet.hairlineWidth}
                borderBottomColor="$borderSubdued"
                alignItems="center"
              >
                <Text variant="$headingLg" color="$text">
                  {title}
                </Text>
                <IconButton
                  buttonVariant="secondary"
                  size="small"
                  hitSlop={8}
                  aria-label="Close"
                >
                  <IconButton.Icon name="CrossedSmallOutline" />
                </IconButton>
              </XStack>
              <Sheet.ScrollView
                borderBottomLeftRadius="$6"
                borderBottomRightRadius="$6"
                backgroundColor="$bg"
                showsVerticalScrollIndicator={false}
                marginHorizontal="$5"
                marginBottom={bottom || '$5'}
              >
                <YStack padding="$3">
                  <Adapt.Contents />
                </YStack>
              </Sheet.ScrollView>
            </>
          </Sheet.Frame>

          <Sheet.Overlay
            animation="quick"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
            backgroundColor="$bgBackdrop"
          />
        </Sheet>
      </Adapt>
      <TMSelect.Content zIndex={200000}>
        <TMSelect.ScrollUpButton
          alignItems="center"
          justifyContent="center"
          paddingVertical="$1"
        >
          <YStack zIndex={10}>
            <Icon
              color="$iconSubdued"
              name="ChevronTopSmallOutline"
              size="$5"
            />
          </YStack>

          <LinearGradient
            start={[0, 0]}
            end={[0, 1]}
            fullscreen
            colors={['$bg', '$transparent']}
            borderRadius="$3"
          />
        </TMSelect.ScrollUpButton>
        <TMSelect.Viewport
          unstyled
          minWidth="$48"
          outlineWidth="$px"
          outlineColor="$neutral2"
          outlineStyle="solid"
          borderRadius="$3"
          overflow="hidden"
          elevate
          backgroundColor="$bg"
          padding="$1"
        >
          <TMSelect.Group>
            <TMSelect.Label asChild>
              <Text
                variant="$headingXs"
                $md={{ variant: '$headingSm', paddingVertical: '$2.5' }}
                paddingVertical="$1.5"
                paddingHorizontal="$2"
                color="$textSubdued"
              >
                Fruits
              </Text>
            </TMSelect.Label>

            {/* for longer lists memoizing these is useful */}

            {useMemo(
              () =>
                data.map((item, i) => (
                  <TMSelect.Item
                    index={i}
                    key={item.name}
                    value={item.name.toLowerCase()}
                    minHeight="auto"
                    backgroundColor="$transparent"
                    borderRadius="$2"
                    paddingVertical="$1.5"
                    paddingHorizontal="$2"
                    $md={{
                      paddingVertical: '$2.5',
                      paddingRight: 11,
                    }}
                    justifyContent="flex-start"
                  >
                    <TMSelect.ItemText
                      flex={1}
                      $md={{
                        fontSize: '$bodyLg',
                        fontWeight: '$bodyLg',
                        lineHeight: '$bodyLg',
                      }}
                      fontSize="$bodyMd"
                      fontWeight="$bodyMd"
                      lineHeight="$bodyMd"
                    >
                      {item.name}
                    </TMSelect.ItemText>

                    <TMSelect.ItemIndicator marginLeft="auto">
                      <Icon
                        name="CheckLargeOutline"
                        size="$4"
                        color="$iconActive"
                        {...(media.md && {
                          name: 'CheckRadioSolid',
                          size: '$6',
                        })}
                      />
                    </TMSelect.ItemIndicator>
                  </TMSelect.Item>
                )),

              [data, media.md],
            )}
          </TMSelect.Group>
        </TMSelect.Viewport>
        <TMSelect.ScrollDownButton
          alignItems="center"
          justifyContent="center"
          paddingVertical="$1"
        >
          <YStack zIndex={10}>
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </YStack>

          <LinearGradient
            start={[0, 0]}
            end={[0, 1]}
            fullscreen
            colors={['$transparent', '$bg']}
            borderRadius="$3"
          />
        </TMSelect.ScrollDownButton>
      </TMSelect.Content>
    </TMSelect>
  );
}

Select.displayName = 'Select';
export { Select };
export type { SelectProps };
