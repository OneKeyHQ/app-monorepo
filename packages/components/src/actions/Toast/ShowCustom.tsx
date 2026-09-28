import type { ForwardedRef, PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { isNil } from 'lodash';
import { Animated, PanResponder, StyleSheet } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSafeAreaInsets } from '../../hooks/useLayout';
import { usePageWidth } from '../../hooks/usePage';
import { Stack, ThemeableStack } from '../../primitives';
import { Trigger } from '../Trigger';

import type {
  IOverlayAnimation,
  IOverlayBackdrop,
  IOverlayDismissReason,
} from '@onekeyfe/react-native-native-overlay';

// The former Tamagui toast: scale 0.8 + fade, 20pt above, `quick` spring.
const CUSTOM_TOAST_ANIMATION: IOverlayAnimation = {
  enter: {
    type: 'scale',
    scale: 0.8,
    offsetY: -20,
    fade: true,
    motion: 'quick',
  },
};
// Tamagui's default swipe threshold.
const SWIPE_UP_THRESHOLD = 50;
const SWIPE_START_THRESHOLD = 6;

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

// eslint-disable-next-line import/no-cycle
export type IShowToasterProps = PropsWithChildren<{
  onClose?: (extra?: { flag?: string }) => Promise<void> | void;
  dismissOnOverlayPress?: boolean;
  duration?: number;
  disableSwipeGesture?: boolean;
  open?: boolean;
  onOpenChange?: (visible: boolean) => void;
  name?: string;
  /** The exit animation finished; `Toast.show` unmounts the portal here. */
  onExited?: () => void;
}>;

export interface IShowToasterInstance {
  close: (extra?: { flag?: string }) => Promise<void> | void;
}

export type IContextType = {
  close: IShowToasterInstance['close'];
};

const CustomToasterContext = createContext({} as IContextType);

// Swipe up to close, as the Tamagui toast did. A PanResponder rather than a
// gesture-handler pan: the content renders in the native overlay window.
function useSwipeUpToClose(onClose: () => void, enabled: boolean) {
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dy, dx }) =>
          enabled && dy < -SWIPE_START_THRESHOLD && Math.abs(dy) > Math.abs(dx),
        onPanResponderMove: (_, { dy }) => {
          translateY.setValue(Math.min(0, dy));
        },
        onPanResponderRelease: (_, { dy }) => {
          if (dy < -SWIPE_UP_THRESHOLD) {
            onCloseRef.current();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        },
      }),
    [enabled, translateY],
  );
  return { translateY, panHandlers: panResponder.panHandlers };
}

function BasicShowToaster({
  children,
  onClose,
  onExited,
  duration = Infinity,
  dismissOnOverlayPress = true,
  disableSwipeGesture = false,
  open,
  onOpenChange,
  ref,
}: IShowToasterProps & { ref?: ForwardedRef<IShowToasterInstance> }) {
  const [isOpenState, setIsOpenState] = useState(true);
  const isControlled = !isNil(open);
  const isOpen = isControlled ? open : isOpenState;
  const setIsOpen = useCallback(
    (value: boolean) => {
      if (isControlled) {
        onOpenChange?.(value);
      }
      setIsOpenState(value);
    },
    [isControlled, onOpenChange],
  );
  const handleClose = useCallback(
    (extra?: { flag?: string }) => {
      setIsOpen(false);
      return onClose?.(extra);
    },
    [onClose, setIsOpen],
  );
  const handleImperativeClose = useCallback(
    (extra?: { flag?: string }) => handleClose(extra),
    [handleClose],
  );

  const handleContainerClose = useCallback(() => handleClose(), [handleClose]);

  useImperativeHandle(
    ref,
    () => ({
      close: handleImperativeClose,
    }),
    [handleImperativeClose],
  );

  useEffect(() => {
    if (!isOpen || !Number.isFinite(duration)) {
      return;
    }
    const timer = setTimeout(() => {
      void handleContainerClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, handleContainerClose, isOpen]);

  const value = useMemo(
    () => ({
      close: handleContainerClose,
    }),
    [handleContainerClose],
  );
  const { top } = useSafeAreaInsets();
  const pageWidth = usePageWidth();
  const { translateY, panHandlers } = useSwipeUpToClose(
    handleContainerClose,
    !disableSwipeGesture,
  );

  // A transparent backdrop keeps taps off the page below, as before.
  const backdrop = useMemo<IOverlayBackdrop>(
    () => ({ color: 'transparent', dismissOnPress: dismissOnOverlayPress }),
    [dismissOnOverlayPress],
  );
  const handleRequestDismiss = useCallback(() => {
    void handleContainerClose();
  }, [handleContainerClose]);
  const handleOverlayClose = useCallback(
    (reason: IOverlayDismissReason) => {
      // The app lock closes it only until unlock; it reopens by itself.
      if (reason !== 'security') {
        translateY.setValue(0);
        onExited?.();
      }
    },
    [onExited, translateY],
  );
  const cardStyle = useMemo(
    () => [styles.card, { paddingTop: top || 20, transform: [{ translateY }] }],
    [top, translateY],
  );

  return (
    <OverlayView
      visible={isOpen}
      level="toast"
      presentation="toast"
      animation={CUSTOM_TOAST_ANIMATION}
      blocking
      backdrop={backdrop}
      dismissOnBackPress={dismissOnOverlayPress}
      onRequestDismiss={handleRequestDismiss}
      onClose={handleOverlayClose}
    >
      {/* The direct child of the overlay root: native animations scale
          around it, not around the window. */}
      <Animated.View
        style={cardStyle}
        pointerEvents="box-none"
        {...panHandlers}
      >
        <Stack
          // A drag that selects text ends the web responder; keep the card
          // unselectable while it can be swiped.
          userSelect={disableSwipeGesture ? undefined : 'none'}
          w={platformEnv.isNative ? pageWidth : undefined}
          maxWidth={platformEnv.isNative ? '$96' : undefined}
          px={platformEnv.isNative ? '$5' : undefined}
        >
          <CustomToasterContext.Provider value={value}>
            <Stack
              testID="confirm-on-device-toast-container"
              borderRadius="$2.5"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
            >
              <ThemeableStack bg="$bg" borderRadius="$2.5" elevation={44}>
                {children}
              </ThemeableStack>
            </Stack>
          </CustomToasterContext.Provider>
        </Stack>
      </Animated.View>
    </OverlayView>
  );
}

export const useToaster = () => useContext(CustomToasterContext);

export function ShowToasterClose({ children }: PropsWithChildren) {
  const { close } = useToaster();
  const handleClose = useCallback(() => {
    void close();
  }, [close]);
  return (
    // testID flows through children supplied by the caller.
    // oxlint-disable-next-line onekey/require-testid
    <Trigger onPress={handleClose}>{children}</Trigger>
  );
}

export const ShowCustom = BasicShowToaster;
