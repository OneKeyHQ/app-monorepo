/* eslint-disable no-nested-ternary */
import type { FC, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { AnimatePresence, MotiView, motify, useDynamicAnimation } from 'moti';
import { MotiPressable } from 'moti/interactions';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import Box from '../Box';
import Button from '../Button';
import NetImage from '../NetImage';
import Pressable from '../Pressable';
import useIsVerticalLayout from '../Provider/hooks/useIsVerticalLayout';
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { Body2, Body2Strong } from '../Typography';

const DISMISS_TIMEOUT = 3000;
const TRANSITION_DURATION = 300;

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
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const isVerticalLayout = useIsVerticalLayout();
  const isHovered = useSharedValue(false);
  const showCloseButtonStyle = useAnimatedStyle(
    () => ({
      display: isHovered.value ? 'flex' : 'none',
      opacity: isHovered.value ? 1 : 0,
    }),
    [],
  );
  const startTransY = isVerticalLayout ? 100 + bottom : -(100 + top);
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), TRANSITION_DURATION);
    }, timeout);
    return () => clearTimeout(timeoutId);
  }, [onClose, timeout]);
  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          from={{
            opacity: 1,
            translateY: startTransY,
          }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ duration: TRANSITION_DURATION, type: 'timing' }}
          exit={{
            opacity: 0,
            translateY: startTransY,
          }}
        >
          <MotiPressable onPress={onBodyPress} hoveredValue={isHovered}>
            <Box
              w={width - 16}
              maxW="374px"
              px="16px"
              py="12px"
              borderRadius="12px"
              borderColor="border-default"
              borderWidth="1px"
              flexDirection="row"
              position="absolute"
              right={isVerticalLayout ? '8px' : '32px'}
              top={isVerticalLayout ? undefined : '32px'}
              bottom={isVerticalLayout ? `${8 + bottom}px` : undefined}
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
                    // resizeMode="cover"
                    src={cover}
                  />
                ) : (
                  <Button onPress={onActionPress}>{actionText}</Button>
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
      )}
    </AnimatePresence>
  );
};

export default InAppNotification;
