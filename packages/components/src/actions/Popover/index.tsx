import { Popover as TMPopover } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FIX_SHEET_PROPS } from '../../composite';
import { Divider } from '../../content';
import { Portal } from '../../hocs';
import { useSafeAreaInsets } from '../../hooks';
import { Text, XStack, YStack } from '../../primitives';
import { IconButton } from '../IconButton';

import type { FocusOutsideEvent } from '@tamagui/dismissable/types';
import type {
  SheetProps,
  PopoverProps as TMPopoverProps,
  YStackProps,
} from 'tamagui';

export interface IPopoverProps extends TMPopoverProps {
  title: string;
  usingSheet?: boolean;
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
  floatingPanelProps?: YStackProps;
  sheetProps?: SheetProps;
  onFocusOutside?: (event: FocusOutsideEvent) => void;
}

function RawPopover({
  title,
  renderTrigger,
  renderContent,
  floatingPanelProps,
  sheetProps,
  onOpenChange,
  onFocusOutside,
  usingSheet = true,
  ...props
}: IPopoverProps) {
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
    <TMPopover
      offset={8}
      allowFlip
      placement="bottom-end"
      onOpenChange={onOpenChange}
      {...props}
    >
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
        onFocusOutside={onFocusOutside}
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
      {usingSheet && (
        <TMPopover.Adapt when="md">
          <TMPopover.Sheet
            dismissOnSnapToBottom
            animation="quick"
            snapPointsMode="fit"
            {...sheetProps}
          >
            <TMPopover.Sheet.Overlay
              {...FIX_SHEET_PROPS}
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
                style={{
                  borderCurve: 'continuous',
                }}
              >
                <Text variant="$headingXl" color="$text">
                  {title}
                </Text>
                <IconButton
                  icon="CrossedSmallOutline"
                  size="small"
                  $platform-native={{
                    hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
                  }}
                  onPress={() => onOpenChange?.(false)}
                  testID="popover-btn-close"
                />
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
                style={{
                  borderCurve: 'continuous',
                }}
              >
                <TMPopover.Adapt.Contents />
              </TMPopover.Sheet.ScrollView>
            </TMPopover.Sheet.Frame>
          </TMPopover.Sheet>
        </TMPopover.Adapt>
      )}
    </TMPopover>
  );
}

const Popover = ({ renderTrigger, sheetProps, ...rest }: IPopoverProps) => {
  // on web and WAP, we add the popover to the RNRootView
  if (platformEnv.isRuntimeBrowser) {
    return (
      <RawPopover
        sheetProps={{ ...sheetProps, modal: true }}
        renderTrigger={renderTrigger}
        {...rest}
      />
    );
  }
  // on native and ipad, we add the popover to the RNScreen.FULL_WINDOW_OVERLAY
  return (
    <>
      {renderTrigger}
      <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
        <RawPopover
          renderTrigger={undefined}
          {...rest}
          sheetProps={sheetProps}
        />
      </Portal.Body>
    </>
  );
};

Popover.Close = TMPopover.Close;

export { Popover };
