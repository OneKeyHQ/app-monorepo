/* eslint-disable no-nested-ternary */
import type { FC, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AnimatePresence, MotiView } from 'moti';
import { MotiPressable } from 'moti/interactions';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import Box from '../Box';
import Button from '../Button';
import NetImage from '../NetImage';
import useIsVerticalLayout from '../Provider/hooks/useIsVerticalLayout';
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { Body2, Body2Strong } from '../Typography';
import { useBeforeOnPress } from '../utils/useBeforeOnPress';

const DISMISS_TIMEOUT = 3000;
const TRANSITION_DURATION = 300;
const MAX_WIDTH = 374;
const DISMISS_DISTANCE = 5;

const AnimatedButton = Animated.createAnimatedComponent(Button);
export interface InAppNotificationProps {
  title: string;
  subtitle?: string;
  cover?: string;
  rightContent?: () => ReactNode;
  actionText?: string;
  onActionPress?: () => void;
  onBodyPress?: () => void;
  footer?: string;
  onClose?: () => void | boolean;
  timeout?: number;
}

enum EXIT_DIRECTION {
  LEFT = 0,
  RIGHT = 1,
  TOP = 2,
  BOTTOM = 3,
}
const InAppNotification: FC<InAppNotificationProps> = ({
  title,
  subtitle,
  cover,
  rightContent,
  actionText,
  onActionPress,
  onBodyPress,
  footer,
  timeout = DISMISS_TIMEOUT,
  onClose,
}) => {
  const { bottom, top } = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const isPositionedBottom = useIsVerticalLayout();
  const isHovered = useSharedValue(false);
  const showCloseButtonStyle = useAnimatedStyle(
    () => ({
      display: isHovered.value ? 'flex' : 'none',
      opacity: isHovered.value ? 1 : 0,
    }),
    [],
  );
  const startTransY = isPositionedBottom ? 100 + bottom : -(100 + top);
  const exitDirection = useSharedValue(-1);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const closeWithAnimation = useCallback(() => {
    clearTimeout(closeTimer.current);
    if (
      (exitDirection.value === EXIT_DIRECTION.TOP && isPositionedBottom) ||
      (exitDirection.value === EXIT_DIRECTION.BOTTOM && !isPositionedBottom)
    ) {
      onBodyPress?.();
    }
    setVisible(false);
    setTimeout(() => {
      onClose?.();
    }, TRANSITION_DURATION);
  }, [exitDirection, isPositionedBottom, onBodyPress, onClose]);

  useEffect(() => {
    closeTimer.current = setTimeout(closeWithAnimation, timeout);
    return () => clearTimeout(closeTimer.current);
  }, [closeWithAnimation, onClose, timeout]);

  const onBodyPressOverride = useBeforeOnPress(() => {
    onClose?.();
    onBodyPress?.();
  }) as () => void;

  const pan = Gesture.Pan().onUpdate(({ translationX, translationY }) => {
    'worklet';

    if (translationX < -DISMISS_DISTANCE) {
      exitDirection.value = EXIT_DIRECTION.LEFT;
    } else if (translationX > DISMISS_DISTANCE) {
      exitDirection.value = EXIT_DIRECTION.RIGHT;
    } else if (translationY < -DISMISS_DISTANCE) {
      exitDirection.value = EXIT_DIRECTION.TOP;
    } else if (translationY > DISMISS_DISTANCE) {
      exitDirection.value = EXIT_DIRECTION.BOTTOM;
    } else {
      return;
    }
    runOnJS(closeWithAnimation);
  });

  const tap = Gesture.Tap().onStart(onBodyPressOverride);

  const animateProp = useDerivedValue(() => {
    'worklet';

    let translateX = 0;
    let translateY = 0;
    let opacity = 0;
    if (exitDirection.value === EXIT_DIRECTION.LEFT) {
      translateX = -100;
    } else if (exitDirection.value === EXIT_DIRECTION.RIGHT) {
      translateX = 100;
    } else if (exitDirection.value === EXIT_DIRECTION.TOP) {
      translateY = -100;
    } else if (exitDirection.value === EXIT_DIRECTION.BOTTOM) {
      translateY = 100;
    } else {
      opacity = 1;
    }
    return {
      opacity,
      translateX,
      translateY,
    };
  });
  return (
    <AnimatePresence>
      {visible && (
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
          <MotiView
            from={{
              opacity: 1,
              translateX: 0,
              translateY: startTransY,
            }}
            animate={animateProp}
            exit={{
              opacity: 0,
              translateX: 0,
              translateY: startTransY,
            }}
            transition={{ duration: TRANSITION_DURATION, type: 'timing' }}
            style={{
              position: 'absolute',
              top: isPositionedBottom ? undefined : 32,
              bottom: isPositionedBottom ? 32 + bottom : undefined,
              right: isPositionedBottom ? 16 : 32,
              // higher than react-native-modalize(9998)
              zIndex: 9999,
            }}
          >
            <MotiPressable hoveredValue={isHovered}>
              <Box
                w={screenW - 32}
                maxW={isPositionedBottom ? undefined : `${MAX_WIDTH}px`}
                px="16px"
                py="12px"
                borderRadius="12px"
                borderColor="border-default"
                borderWidth="1px"
                flexDirection="row"
                bg="surface-default"
              >
                <Box flex={1}>
                  <Body2Strong mb="4px">{title}</Body2Strong>
                  {!!subtitle && <Body2>{subtitle}</Body2>}
                  {!!footer && <Body2>{footer}</Body2>}
                </Box>
                <Box ml="auto" justifyContent="center">
                  {rightContent ? (
                    rightContent()
                  ) : cover ? (
                    <NetImage
                      width="40px"
                      height="40px"
                      resizeMode="cover"
                      src={cover}
                    />
                  ) : (
                    <Button
                      onPress={() => {
                        onClose?.();
                        onActionPress?.();
                      }}
                    >
                      {actionText}
                    </Button>
                  )}
                </Box>
                <AnimatedButton
                  style={showCloseButtonStyle}
                  rounded="full"
                  position="absolute"
                  zIndex={1}
                  right="4px"
                  top="-4px"
                  leftIconName="XCircleMini"
                  iconSize={16}
                  pt={0}
                  pr={0}
                  pb={0}
                  pl={0}
                  onPress={onClose}
                />
              </Box>
            </MotiPressable>
          </MotiView>
        </GestureDetector>
      )}
    </AnimatePresence>
  );
};

export default InAppNotification;
