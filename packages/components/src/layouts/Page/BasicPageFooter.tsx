import type { PropsWithChildren } from 'react';
import { memo, useContext, useLayoutEffect } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useKeyboardEvent, useSafeAreaInsets } from '../../hooks';
import { View } from '../../optimization';
import { NavigationContext } from '../Navigation/context';

import { FooterActions } from './FooterActions';
import { PageContext } from './PageContext';

import type { IPageFooterProps } from './type';

export function BasicPageFooterContainer() {
  const { options } = useContext(PageContext);
  return options?.footerElement;
}

export const BasicPageFooter = memo(BasicPageFooterContainer);

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
  const bottom = useSafeAreaBottom();
  const { bottom: safeBottomHeight } = useSafeAreaInsets();
  const keyboardHeightValue = useSharedValue(bottom);
  const animatedStyles = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightValue.value + bottom,
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

const PageContainer = ({ children }: PropsWithChildren) => {
  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();
  // if (!options?.footerElement) {
  //   return bottom > 0 ? <View style={{ height: bottom }} /> : null;
  // }
  return (
    <Animated.View
      style={platformEnv.isNativeIOS ? safeKeyboardAnimationStyle : undefined}
    >
      {children}
    </Animated.View>
  );
};

export function PageFooterContext(props: IPageFooterProps) {
  const { setOptions } = useContext(PageContext);
  const { children, ...restProps } = props;
  useLayoutEffect(() => {
    setOptions?.((options) => ({
      ...options,
      footerElement: props ? (
        <PageContainer>
          {children || <FooterActions {...restProps} />}
        </PageContainer>
      ) : (
        <Placeholder />
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);
  return null;
}
