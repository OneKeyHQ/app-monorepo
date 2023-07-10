/* eslint-disable no-nested-ternary */
import type { FC, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AnimatePresence, MotiView } from 'moti';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import Box from '../Box';
import HoverContainer, { AnimatedButton } from '../HoverContainer';
import NetImage from '../NetImage';
import useIsVerticalLayout from '../Provider/hooks/useIsVerticalLayout';
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { Body2, Body2Strong } from '../Typography';
import { useBeforeOnPress } from '../utils/useBeforeOnPress';

const DISMISS_TIMEOUT = 3000;
const TRANSITION_DURATION = 300;
const MAX_WIDTH = 374;
const DISMISS_DISTANCE = 5;
const VELOCITY_THRESHOLD = 20;

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

// eslint-disable-next-line @typescript-eslint/naming-convention
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
  const { width: screenW } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const isPositionedBottom = useIsVerticalLayout();
  const startTransY = isPositionedBottom ? 100 + bottom : -(100 + top);
  const exitDirection = useSharedValue(-1);

  const actionButtonStyle = useAnimatedStyle(
    () => ({
      display: exitDirection.value === -1 ? 'flex' : 'none',
    }),
    [],
  );
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

  const pan = Gesture.Pan().onUpdate(
    ({ translationX, translationY, velocityX, velocityY }) => {
      'worklet';

      const distanceX = Math.abs(translationX);
      const distanceY = Math.abs(translationY);
      const velocityMagnitude = Math.sqrt(velocityX ** 2 + velocityY ** 2);

      if (distanceY < DISMISS_DISTANCE && distanceX < DISMISS_DISTANCE) {
        return;
      }

      if (velocityMagnitude > VELOCITY_THRESHOLD) {
        if (Math.abs(velocityX) > Math.abs(velocityY)) {
          exitDirection.value =
            velocityX > 0 ? EXIT_DIRECTION.RIGHT : EXIT_DIRECTION.LEFT;
        } else {
          exitDirection.value =
            velocityY > 0 ? EXIT_DIRECTION.BOTTOM : EXIT_DIRECTION.TOP;
        }
      } else if (distanceY > distanceX) {
        exitDirection.value =
          translationY > 0 ? EXIT_DIRECTION.BOTTOM : EXIT_DIRECTION.TOP;
      } else {
        exitDirection.value =
          translationX > 0 ? EXIT_DIRECTION.RIGHT : EXIT_DIRECTION.LEFT;
      }

      runOnJS(closeWithAnimation);
    },
  );

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
        <GestureDetector gesture={Gesture.Race(pan, tap)}>
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
            <HoverContainer
              hoverButtonProps={{
                rounded: 'full',
                position: 'absolute',
                zIndex: 1,
                right: '4px',
                top: '-4px',
                leftIconName: 'XCircleMini',
                iconSize: 16,
                pt: 0,
                pr: 0,
                pb: 0,
                pl: 0,
                onPress: onClose,
              }}
            >
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
                    <AnimatedButton
                      style={actionButtonStyle}
                      onPress={() => {
                        onClose?.();
                        onActionPress?.();
                      }}
                    >
                      {actionText}
                    </AnimatedButton>
                  )}
                </Box>
              </Box>
            </HoverContainer>
          </MotiView>
        </GestureDetector>
      )}
    </AnimatePresence>
  );
};

export default InAppNotification;
