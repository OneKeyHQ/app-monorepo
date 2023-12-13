import type { PropsWithChildren } from 'react';
import { useContext } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getTokenValue,
  useKeyboardEvent,
  useSafeAreaInsets,
} from '../../hooks';
import { Button, type IButtonProps, Stack, XStack } from '../../primitives';

import { PageContext } from './PageContext';

type IActionButtonProps = Omit<IButtonProps, 'onPress' | 'children'>;

export interface IPageButtonGroupProps extends PropsWithChildren<unknown> {
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IActionButtonProps;
  cancelButtonProps?: IActionButtonProps;
}

const useSafeKeyboardAnimationStyle = () => {
  const { bottom: safeBottomHeight } = useSafeAreaInsets();
  const keyboardHeightValue = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightValue.value,
  }));
  useKeyboardEvent({
    keyboardWillShow: (e) => {
      const keyboardHeight = e.endCoordinates.height;
      keyboardHeightValue.value = withTiming(keyboardHeight - safeBottomHeight);
    },
    keyboardWillHide: () => {
      keyboardHeightValue.value = withTiming(0);
    },
  });
  return animatedStyles;
};

export function PageButtonGroup() {
  const { options } = useContext(PageContext);
  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();

  if (!options?.footerOptions) {
    return null;
  }

  const {
    onCancel,
    onCancelText,
    onConfirm,
    onConfirmText,
    confirmButtonProps,
    cancelButtonProps,
    children,
  } = options.footerOptions;

  if (children) {
    return children;
  }

  return (
    <Animated.View
      style={platformEnv.isNativeIOS ? safeKeyboardAnimationStyle : undefined}
    >
      <Stack
        p="$5"
        animation="fast"
        pb={getTokenValue('$size.5') as number}
        bg="$bgApp"
      >
        <XStack justifyContent="flex-end">
          {(!!cancelButtonProps || !!onCancel) && (
            <Button
              $md={
                {
                  flex: 1,
                  size: 'large',
                } as IButtonProps
              }
              $platform-native={{}}
              onPress={onCancel}
              {...cancelButtonProps}
            >
              {onCancelText || 'Cancel'}
            </Button>
          )}
          {(!!confirmButtonProps || !!onConfirm) && (
            <Button
              $md={
                {
                  flex: 1,
                  size: 'large',
                } as IButtonProps
              }
              $platform-native={{}}
              variant="primary"
              onPress={onConfirm}
              {...confirmButtonProps}
            >
              {onConfirmText || 'Confirm'}
            </Button>
          )}
        </XStack>
      </Stack>
    </Animated.View>
  );
}
