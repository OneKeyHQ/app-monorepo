/* eslint-disable no-nested-ternary */
import type { FC, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { AnimatePresence, MotiView } from 'moti';
import { useWindowDimensions } from 'react-native';

import Box from '../Box';
import Button from '../Button';
import IconButton from '../IconButton';
import NetImage from '../NetImage';
import Pressable from '../Pressable';
import useIsVerticalLayout from '../Provider/hooks/useIsVerticalLayout';
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { Body2, Body2Strong } from '../Typography';

const DISMISS_TIMEOUT = 3000;
const TRANSITION_DURATION = 300;
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
          <Pressable
            w={width - 16}
            onPress={onBodyPress}
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
            {({ isHovered, isPressed }) => (
              <>
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
                {/* {isHovered && (
                  <IconButton
                    size="sm"
                    rounded="full"
                    position="absolute"
                    zIndex={1}
                    right="4px"
                    top="-4px"
                    name="XCircleMini"
                    onPress={onClose}
                  />
                )} */}
              </>
            )}
          </Pressable>
        </MotiView>
      )}
    </AnimatePresence>
  );
};

export default InAppNotification;
