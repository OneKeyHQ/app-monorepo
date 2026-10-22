import { useCallback, useMemo } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useTheme } from '../../hooks/useStyle';
import { ScrollView } from '../../layouts/ScrollView';
import { ThemeableStack } from '../../primitives';

import type { IColorTokens } from '../../types';
import type {
  IOverlayBackdrop,
  IOverlayDismissReason,
  IOverlayLevel,
  IOverlayRequestDismissReason,
  IOverlaySheetOptions,
} from '@onekeyfe/react-native-native-overlay';

const MAX_CONTENT_WIDTH = 400;
const SHEET_CORNER_RADIUS = 24;
const CENTER_SIDE_GUTTER = 20;
const CENTER_THEME_DARK = { outlineColor: '$neutral5' } as const;
const CENTER_CARD_STYLE = { outlineStyle: 'solid' } as const;
const GESTURE_ROOT_FIT_STYLE = { flexGrow: 0, flexShrink: 1 } as const;

export type IOverlayDialogCardProps = Omit<
  ComponentProps<typeof ThemeableStack>,
  'children'
>;

export interface IOverlayDialogPresentationProps extends PropsWithChildren {
  open: boolean;
  level: IOverlayLevel;
  /** Bottom sheet on narrow windows, centered card otherwise. */
  isSheet: boolean;
  bg?: IColorTokens;
  dismissOnOverlayPress: boolean;
  /** Android back. Escape never closes a dialog on web. */
  dismissOnBackPress: boolean;
  disableDrag: boolean;
  onRequestClose: () => void;
  /** The exit animation finished; `Dialog.show` unmounts its portal here. */
  onExited?: () => void;
  onAnimationComplete?: (info: { open: boolean }) => void;
  /** Page scope: the page's root-route host and the owning page. */
  page?: { hostKey: string; ownerKey: string };
  /** Centered card only: the former floating panel styling (width, bg…). */
  cardProps?: IOverlayDialogCardProps;
  testID?: string;
}

/**
 * Renders a Dialog in the native overlay: a bottom sheet or a centered card
 * at `level`, instead of a Tamagui Sheet / Dialog portal.
 */
export function OverlayDialogPresentation({
  open,
  level,
  isSheet,
  bg,
  dismissOnOverlayPress,
  dismissOnBackPress,
  disableDrag,
  onRequestClose,
  onExited,
  onAnimationComplete,
  page,
  cardProps,
  testID,
  children,
}: IOverlayDialogPresentationProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const surfaceColor = useMemo(() => {
    const token = (bg ?? '$bg').replace(/^\$/, '') as keyof typeof theme;
    return String(theme[token]?.val ?? theme.bg.val);
  }, [bg, theme]);

  const backdrop = useMemo<IOverlayBackdrop>(
    () => ({
      color: String(theme.bgBackdrop.val),
      dismissOnPress: dismissOnOverlayPress,
    }),
    [dismissOnOverlayPress, theme.bgBackdrop.val],
  );
  const sheet = useMemo<IOverlaySheetOptions>(
    () => ({
      cornerRadius: SHEET_CORNER_RADIUS,
      showHandle: false,
      backgroundColor: surfaceColor,
      dismissOnPanDown: !disableDrag,
    }),
    [disableDrag, surfaceColor],
  );

  const handleRequestDismiss = useCallback(
    (_reason: IOverlayRequestDismissReason) => {
      onRequestClose();
    },
    [onRequestClose],
  );
  const handleClose = useCallback(
    (reason: IOverlayDismissReason) => {
      // The store closed it on its own; keep the caller's state in sync.
      if (reason === 'replaced' || reason === 'page-removed') {
        onRequestClose();
      }
      if (isSheet) onAnimationComplete?.({ open: false });
      onExited?.();
    },
    [isSheet, onAnimationComplete, onExited, onRequestClose],
  );

  const handlePresented = useCallback(() => {
    if (isSheet) onAnimationComplete?.({ open: true });
  }, [isSheet, onAnimationComplete]);
  const needsGestureRoot = platformEnv.isNativeAndroid && !page;
  const centerContent = platformEnv.isNative ? (
    // Yoga measures the card in AtMost mode, so `flex: 1` children
    // collapse; a ScrollView measures its content unconstrained, as
    // the Tamagui dialog did.
    <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <OverlayView
      visible={open}
      level={level}
      scope={page ? 'page' : 'global'}
      hostKey={page?.hostKey}
      ownerKey={page?.ownerKey}
      presentation={isSheet ? 'sheet' : 'center'}
      sheet={isSheet ? sheet : undefined}
      backdrop={backdrop}
      dismissOnBackPress={platformEnv.isNative ? dismissOnBackPress : false}
      onRequestDismiss={handleRequestDismiss}
      onClose={handleClose}
      onPresented={handlePresented}
      testID={testID}
    >
      {isSheet ? (
        <ThemeableStack
          bg={bg ?? '$bg'}
          borderTopLeftRadius="$6"
          borderTopRightRadius="$6"
          borderCurve="continuous"
          overflow="hidden"
        >
          {needsGestureRoot ? (
            <GestureHandlerRootView style={GESTURE_ROOT_FIT_STYLE}>
              {children}
            </GestureHandlerRootView>
          ) : (
            children
          )}
        </ThemeableStack>
      ) : (
        // The card is the overlay root's direct child, centered by auto
        // margins: native reads the root's children to find the content for
        // the scale origin and the keyboard lift.
        <ThemeableStack
          // Separate auto margins: `marginVertical: 'auto'` is dropped on web.
          alignSelf="center"
          mt="auto"
          mb="auto"
          width={MAX_CONTENT_WIDTH}
          maxWidth={windowWidth - CENTER_SIDE_GUTTER * 2}
          maxHeight="90%"
          bg={bg ?? '$bg'}
          borderRadius="$4"
          borderCurve="continuous"
          elevation={20}
          outlineWidth={1}
          outlineOffset={0}
          outlineColor="$neutral3"
          $theme-dark={CENTER_THEME_DARK}
          style={CENTER_CARD_STYLE}
          {...cardProps}
        >
          {needsGestureRoot ? (
            <GestureHandlerRootView style={GESTURE_ROOT_FIT_STYLE}>
              {centerContent}
            </GestureHandlerRootView>
          ) : (
            centerContent
          )}
        </ThemeableStack>
      )}
    </OverlayView>
  );
}
