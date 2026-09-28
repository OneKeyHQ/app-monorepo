import { useCallback, useMemo } from 'react';
import type { PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { StyleSheet, View } from 'react-native';

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
const CENTER_THEME_DARK = { outlineColor: '$neutral5' } as const;
const CENTER_OUTLINE_STYLE = { outlineStyle: 'solid' } as const;

const styles = StyleSheet.create({
  // The direct child of the overlay root: native animations scale around
  // it, and it lets backdrop taps through around the card.
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});

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
  testID,
  children,
}: IOverlayDialogPresentationProps) {
  const theme = useTheme();
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
    },
    [onRequestClose],
  );

  return (
    <OverlayView
      visible={open}
      level={level}
      presentation={isSheet ? 'sheet' : 'center'}
      sheet={isSheet ? sheet : undefined}
      backdrop={backdrop}
      dismissOnBackPress={platformEnv.isNative ? dismissOnBackPress : false}
      onRequestDismiss={handleRequestDismiss}
      onClose={handleClose}
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
          {children}
        </ThemeableStack>
      ) : (
        <View style={styles.center} pointerEvents="box-none">
          <ThemeableStack
            width={MAX_CONTENT_WIDTH}
            maxWidth="100%"
            maxHeight="90%"
            bg={bg ?? '$bg'}
            borderRadius="$4"
            borderCurve="continuous"
            elevation={20}
            outlineWidth={1}
            outlineOffset={0}
            outlineColor="$neutral3"
            $theme-dark={CENTER_THEME_DARK}
            style={CENTER_OUTLINE_STYLE}
          >
            {platformEnv.isNative ? (
              // The card sits in an absolute-fill box, so Yoga measures it in
              // AtMost mode and `flex: 1` children collapse; a ScrollView
              // measures its content unconstrained, as the Tamagui dialog did.
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                {children}
              </ScrollView>
            ) : (
              children
            )}
          </ThemeableStack>
        </View>
      )}
    </OverlayView>
  );
}
