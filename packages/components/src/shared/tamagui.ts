// Core exports (only exports not available in web)
export {
  Stack,
  TamaguiProvider as OGProvider,
  useComposedRefs,
  themeable,
  variableToString,
  getVariableValue,
  getTokens as coreGetTokens,
} from '@tamagui/core';

export type {
  ThemeTokens,
  TamaguiTextElement,
  TamaguiProviderProps,
  VariableVal,
  SizeVariantSpreadFunction,
  UseMediaState,
  GestureReponderEvent,
} from '@tamagui/core';

// Web exports
export {
  View,
  getTokens,
  getTokenValue,
  useTheme,
  useMedia,
  useThemeName,
  useStyle,
  usePropsAndStyle,
  createStyledContext,
  styled,
  Theme as TamaguiTheme,
  getConfig,
  useProps,
  withStaticProperties,
  Unspaced,
} from '@tamagui/web';

export type {
  GetProps,
  View as ViewType,
  SizeTokens,
  FontSizeTokens,
  FontTokens,
  Variable,
  StackProps,
  StackStyle,
  Tokens,
  ColorTokens,
  TamaguiElement,
  UseThemeResult,
  Token,
  ThemeProps,
} from '@tamagui/web';

// Stacks
export { ThemeableStack, YStack, XStack, ZStack } from '@tamagui/stacks';
export type {
  ThemeableStackProps,
  YStackProps,
  XStackProps,
  ZStackProps,
} from '@tamagui/stacks';

// Animate Presence
export { AnimatePresence } from '@tamagui/animate-presence';

export type { SizableTextProps, HeadingProps } from '@tamagui/text';

// Font Size
export { getFontSize, getFontSizeToken } from '@tamagui/font-size';

// Label
export { Label as TMLabel } from '@tamagui/label';

// Group
export { Group, XGroup, YGroup } from '@tamagui/group';
export type { GroupProps } from '@tamagui/group';

// Toggle Group
export { ToggleGroup } from '@tamagui/toggle-group';
export type {
  ToggleGroupItemProps,
  ToggleGroupSingleProps,
} from '@tamagui/toggle-group';

// Accordion
export { Accordion } from '@tamagui/accordion';
export type {
  AccordionContentProps,
  AccordionHeaderProps,
  AccordionItemProps,
  AccordionMultipleProps,
  AccordionSingleProps,
  AccordionTriggerProps,
} from '@tamagui/accordion';

// Dialog
export { Dialog as TMDialog } from '@tamagui/dialog';
export type { DialogContentProps, DialogProps } from '@tamagui/dialog';

// Popover
export { Popover as TMPopover } from '@tamagui/popover';
export type {
  PopoverContentProps,
  PopoverProps as TMPopoverProps,
} from '@tamagui/popover';

// Sheet
export { Sheet } from '@tamagui/sheet';
export type { SheetProps } from '@tamagui/sheet';

// Portal
export { PortalProvider } from '@tamagui/portal';

// Tooltip
export { Tooltip as TMTooltip } from '@tamagui/tooltip';
export type { TooltipProps } from '@tamagui/tooltip';

// Toast
export { Toast, ToastViewport, ToastProvider } from '@tamagui/toast';

// Switch
export { Switch as TMSwitch } from '@tamagui/switch';

// Slider
export { Slider as TMSlider } from '@tamagui/slider';

// Separator
export { Separator } from '@tamagui/separator';

// Radio Group
export { RadioGroup } from '@tamagui/radio-group';

// Checkbox
export type { CheckboxProps as TMCheckboxProps } from '@tamagui/checkbox';

// Checkbox Headless
export type { CheckedState } from '@tamagui/checkbox-headless';

// List Item
export type { ListItemProps } from '@tamagui/list-item';

// Avatar
export type { AvatarImage } from '@tamagui/avatar';

// Focusable
export { registerFocusable, useFocusable } from '@tamagui/focusable';

// Get Button Sized
export { getButtonSized } from '@tamagui/get-button-sized';

// Get Font Sized
export { getFontSized } from '@tamagui/get-font-sized';

// Get Token
export { getSpace, getSize } from '@tamagui/get-token';

// Create Context
export { createContextScope } from '@tamagui/create-context';

// Form
export { Form as TMForm } from '@tamagui/form';
