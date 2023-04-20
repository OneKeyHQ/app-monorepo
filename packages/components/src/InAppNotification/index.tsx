/* eslint-disable no-nested-ternary */
import type { FC, ReactNode } from 'react';

import { AnimatePresence, MotiView } from 'moti';
import { useWindowDimensions } from 'react-native';

import Box from '../Box';
import Button from '../Button';
import NetImage from '../NetImage';
import useIsVerticalLayout from '../Provider/hooks/useIsVerticalLayout';
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { Body2, Body2Strong } from '../Typography';

export interface InAppNotificationProps {
  title: string;
  subtitle?: string;
  cover?: string;
  rightContent?: () => ReactNode;
  actionText?: string;
  onActionPress?: () => void;
  linkedRoute: string;
  linkedRouteParams?: Record<string, unknown>;
  footer?: string;
  onClose?: () => void | boolean;
}
const InAppNotification: FC<InAppNotificationProps> = ({
  title,
  subtitle,
  cover,
  rightContent,
  actionText,
  onActionPress,
  linkedRoute,
  linkedRouteParams,
  footer,
}) => {
  const { bottom, top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <AnimatePresence>
      <MotiView
        from={{
          opacity: 1,
          translateY: isVerticalLayout ? 100 + bottom : -(100 + top),
        }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{
          opacity: 0,
        }}
      >
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
          right={isVerticalLayout ? 8 : 32}
          top={isVerticalLayout ? undefined : 32}
          bottom={isVerticalLayout ? 8 + bottom : undefined}
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
              <NetImage width={40} height={40} src={cover} />
            ) : (
              <Button onPress={onActionPress} />
            )}
          </Box>
        </Box>
      </MotiView>
    </AnimatePresence>
  );
};

export default InAppNotification;
