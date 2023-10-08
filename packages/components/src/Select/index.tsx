import { useMemo } from 'react';

import { StyleSheet } from 'react-native';
import {
  Adapt,
  Sheet,
  Select as TMSelect,
  useControllableState,
  useMedia,
} from 'tamagui';
import { LinearGradient } from 'tamagui/linear-gradient';

import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { XStack, YStack } from '../Stack';
import { Text } from '../Text';

import type {
  ListItemProps,
  SelectTriggerProps,
  SheetProps,
  SelectProps as TMSelectProps,
} from 'tamagui';

interface ISelectItem {
  label: string;
  value: string;
  leading?: ListItemProps['icon']; //
}

interface SelectProps extends TMSelectProps {
  data: ISelectItem[];
  snapPointsMode?: SheetProps['snapPointsMode'];
  title: string;
  triggerProps?: SelectTriggerProps;
  renderTrigger?: (item?: ISelectItem) => JSX.Element;
}

function Select({
  data,
  snapPointsMode,
  title = 'Title',
  open,
  defaultOpen,
  onOpenChange,
  triggerProps,
  value,
  defaultValue,
  onValueChange,
  renderTrigger,
  ...props
}: SelectProps) {
  const { bottom } = useSafeAreaInsets();
  const media = useMedia();

  const [isOpen, setOpen] = useControllableState({
    prop: open,
    defaultProp: !!defaultOpen,
    onChange: onOpenChange,
  });

  const [innerValue, setInnerValue] = useControllableState({
    prop: value,
    defaultProp: defaultValue || '',
    onChange: onValueChange,
  });

  const activeItem = useMemo(
    () => data.find((item) => item.value === innerValue),
    [data, innerValue],
  );

  return (
    <TMSelect
      {...props}
      disablePreventBodyScroll
      open={isOpen}
      onOpenChange={setOpen}
      value={innerValue}
      onValueChange={setInnerValue}
    >
      {renderTrigger ? (
        <TMSelect.Trigger
          unstyled
          backgroundColor="$transparent"
          {...triggerProps}
        >
          {renderTrigger(activeItem)}
        </TMSelect.Trigger>
      ) : (
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
          iconAfter={
            <Icon
              color="$iconSubdued"
              name="ChevronDownSmallOutline"
              size="$5"
            />
          }
          {...triggerProps}
        >
          <TMSelect.Value
            placeholder="Something"
            unstyled
            fontSize="$bodyLg"
            fontWeight="$bodyLg"
          />
        </TMSelect.Trigger>
      )}

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
                  buttonVariant="tertiary"
                  size="small"
                  hitSlop={8}
                  aria-label="Close"
                  onPress={() => setOpen(false)}
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
          {useMemo(
            () =>
              data.map((item, i) => (
                <TMSelect.Item
                  index={i}
                  key={item.value}
                  value={item.value}
                  minHeight="auto"
                  backgroundColor="$transparent"
                  borderRadius="$2"
                  paddingVertical="$1.5"
                  paddingHorizontal="$2"
                  $md={{
                    paddingVertical: '$2.5',
                    paddingRight: 11,
                  }}
                  icon={item.leading}
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
                    {item.label}
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
export type { SelectProps, ISelectItem };
