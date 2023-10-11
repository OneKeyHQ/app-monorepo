import { Popover as TMPopover } from 'tamagui';

import { Divider } from '../Divider';
import { IconButton } from '../IconButton';
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { XStack, YStack } from '../Stack';
import { Text } from '../Text';

import type {
  SheetProps,
  PopoverProps as TMPopoverProps,
  YStackProps,
} from 'tamagui';

export interface PopoverProps extends TMPopoverProps {
  title: string;
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
  floatingPanelProps?: YStackProps;
  sheetProps?: SheetProps;
}

export function Popover({
  title,
  renderTrigger,
  renderContent,
  floatingPanelProps,
  sheetProps,
  ...props
}: PopoverProps) {
  const { bottom } = useSafeAreaInsets();
  let transformOrigin;

  switch (props.placement) {
    case 'top':
      transformOrigin = 'bottom center';
      break;
    case 'bottom':
      transformOrigin = 'top center';
      break;
    case 'left':
      transformOrigin = 'right center';
      break;
    case 'right':
      transformOrigin = 'left center';
      break;
    case 'top-start':
      transformOrigin = 'bottom left';
      break;
    case 'top-end':
      transformOrigin = 'bottom right';
      break;
    case 'right-start':
      transformOrigin = 'top left';
      break;
    case 'bottom-start':
      transformOrigin = 'top left';
      break;
    case 'left-start':
      transformOrigin = 'top right';
      break;
    case 'left-end':
      transformOrigin = 'bottom right';
      break;
    default:
      transformOrigin = 'top right';
  }

  return (
    <TMPopover offset={8} allowFlip placement="bottom-end" {...props}>
      <TMPopover.Trigger asChild>{renderTrigger}</TMPopover.Trigger>

      {/* floating panel */}
      <TMPopover.Content
        unstyled
        outlineColor="$neutral3"
        outlineStyle="solid"
        outlineWidth="$px"
        style={{
          transformOrigin,
        }}
        enterStyle={{
          scale: 0.95,
          opacity: 0,
        }}
        exitStyle={{ scale: 0.95, opacity: 0 }}
        w="$96"
        bg="$bg"
        borderRadius="$3"
        elevation={20}
        animation={[
          'quick',
          {
            opacity: {
              overshootClamping: true,
            },
          },
        ]}
        {...floatingPanelProps}
      >
        <TMPopover.ScrollView>{renderContent}</TMPopover.ScrollView>
      </TMPopover.Content>

      {/* sheet */}
      <TMPopover.Adapt when="md">
        <TMPopover.Sheet
          modal
          dismissOnSnapToBottom
          animation="quick"
          snapPointsMode="fit"
          {...sheetProps}
        >
          <TMPopover.Sheet.Overlay
            backgroundColor="$bgBackdrop"
            animation="quick"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <TMPopover.Sheet.Frame unstyled>
            {/* header */}
            <XStack
              borderTopLeftRadius="$6"
              borderTopRightRadius="$6"
              backgroundColor="$bg"
              marginHorizontal="$5"
              paddingHorizontal="$5"
              paddingVertical="$4"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text variant="$headingXl" color="$text">
                {title}
              </Text>
              <TMPopover.Close asChild>
                <IconButton
                  buttonVariant="secondary"
                  size="small"
                  $platform-native={{ hitSlop: 8 }}
                >
                  <IconButton.Icon name="CrossedSmallOutline" />
                </IconButton>
              </TMPopover.Close>
            </XStack>

            {/* divider */}
            <YStack
              backgroundColor="$bg"
              marginHorizontal="$5"
              paddingHorizontal="$5"
            >
              <Divider />
            </YStack>

            <TMPopover.Sheet.ScrollView
              borderBottomLeftRadius="$6"
              borderBottomRightRadius="$6"
              backgroundColor="$bg"
              showsVerticalScrollIndicator={false}
              marginHorizontal="$5"
              marginBottom={bottom || '$5'}
            >
              <TMPopover.Adapt.Contents />
            </TMPopover.Sheet.ScrollView>
          </TMPopover.Sheet.Frame>
        </TMPopover.Sheet>
      </TMPopover.Adapt>
    </TMPopover>
  );
}

Popover.Close = TMPopover.Close;
