import type { PropsWithChildren } from 'react';
import {
  memo,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

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

const useSafeAreaBottom = () => {
  const { pageType } = useContext(NavigationContext);
  const { safeAreaEnabled } = useContext(PageContext);
  const { bottom } = useSafeAreaInsets();
  return safeAreaEnabled && pageType === 'modal' ? bottom : 0;
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
  const { footerRef } = useContext(PageContext);
  useMemo(() => {
    footerRef.current.props = props;
    footerRef.current.notifyUpdate?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    footerRef.current.props = props;
    footerRef.current.notifyUpdate?.();
  }, [footerRef, props]);
  return null;
}

export function BasicPageFooter() {
  const { footerRef } = useContext(PageContext);
  const [, setCount] = useState(0);
  const { props: footerProps } = footerRef.current;
  useMemo(() => {
    footerRef.current.notifyUpdate = () => {
      setCount((i) => i + 1);
    };
  }, [footerRef]);
  return footerProps ? (
    <PageFooterContainer>
      {footerProps.children ? (
        footerProps.children
      ) : (
        <FooterActions {...footerProps} />
      )}
    </PageFooterContainer>
  ) : (
    <Placeholder />
  );
}

export const PageFooter = memo(PageFooterContext);
