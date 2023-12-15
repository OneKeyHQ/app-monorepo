import type { PropsWithChildren } from 'react';
import { memo, useContext, useLayoutEffect, useMemo } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useKeyboardEvent, useSafeAreaInsets } from '../../hooks';
import { View } from '../../optimization';
import { NavigationContext } from '../Navigation/context';

import { PageContext } from './PageContext';
import { FooterActions } from './PageFooterActions';

import type { IPageFooterProps } from './type';

export function BasicPageFooter() {
  const { options } = useContext(PageContext);
  return useMemo(() => options?.footerElement, [options?.footerElement]);
}

const useSafeAreaBottom = () => {
  const { pageType } = useContext(NavigationContext);
  const { options } = useContext(PageContext);
  const { bottom } = useSafeAreaInsets();
  return options?.safeAreaEnabled && pageType === 'modal' ? bottom : 0;
};

const Placeholder = () => {
  const bottom = useSafeAreaBottom();
  return bottom > 0 ? <View style={{ height: bottom }} /> : null;
};

const useSafeKeyboardAnimationStyle = () => {
  const { bottom: safeBottomHeight } = useSafeAreaInsets();
  const keyboardHeightValue = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightValue.value + safeBottomHeight,
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

const PageFooterContainer = ({ children }: PropsWithChildren) => {
  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();
  return (
    <Animated.View
      style={platformEnv.isNativeIOS ? safeKeyboardAnimationStyle : undefined}
    >
      {children}
    </Animated.View>
  );
};

function PageFooterContext(props: IPageFooterProps) {
  const { setOptions } = useContext(PageContext);
  const {
    children,
    onCancel,
    onCancelText,
    onConfirm,
    onConfirmText,
    confirmButtonProps,
    cancelButtonProps,
    extraData,
  } = props;

  const element = useMemo(
    () =>
      props ? (
        <PageFooterContainer>
          {children || (
            <FooterActions
              onCancel={onCancel}
              onCancelText={onCancelText}
              onConfirm={onConfirm}
              onConfirmText={onConfirmText}
              confirmButtonProps={confirmButtonProps}
              cancelButtonProps={cancelButtonProps}
            />
          )}
        </PageFooterContainer>
      ) : (
        <Placeholder />
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    extraData,
  );
  useLayoutEffect(() => {
    setOptions?.((options) => ({
      ...options,
      footerElement: element,
    }));
  }, [element, setOptions]);
  return null;
}

export const PageFooter = memo(PageFooterContext);
