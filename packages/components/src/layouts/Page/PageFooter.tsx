import type { PropsWithChildren } from 'react';
import { memo, useContext, useEffect, useMemo, useState } from 'react';

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useReanimatedKeyboardAnimation } from '../../hooks/useKeyboardController';
import { OptimizationView } from '../../optimization';

import { useSafeAreaBottom, useTabBarHeight } from './hooks';
import { PageContext } from './PageContext';
import { FooterActions } from './PageFooterActions';

import type { IPageFooterProps } from './type';

// The default FooterActions already adds $5 (20) of bottom padding. Subtracting
// 10 keeps a 10-unit visual gap above system UI; custom footers retain full inset.
const DEFAULT_FOOTER_SAFE_BOTTOM_REDUCTION = 10;

const Placeholder = () => {
  const bottom = useSafeAreaBottom();
  const style = useMemo(() => ({ height: bottom }), [bottom]);
  return bottom > 0 ? <OptimizationView style={style} /> : null;
};

const PageFooterContainer = ({
  children,
  disableKeyboardAnimation,
  hasDefaultFooterActions,
}: PropsWithChildren & {
  disableKeyboardAnimation: boolean;
  hasDefaultFooterActions: boolean;
}) => {
  const safeBottomHeight = useSafeAreaBottom();
  const tabBarHeight = useTabBarHeight();
  const { height: keyboardHeight, progress: keyboardProgress } =
    useReanimatedKeyboardAnimation();
  const { gtMd } = useMedia();

  const animatedStyle = useAnimatedStyle(() => {
    const keyboardOffset = disableKeyboardAnimation
      ? 0
      : Math.max(Math.abs(keyboardHeight.value) - tabBarHeight, 0);
    const adjustedSafeBottomHeight =
      hasDefaultFooterActions &&
      safeBottomHeight > DEFAULT_FOOTER_SAFE_BOTTOM_REDUCTION
        ? safeBottomHeight - DEFAULT_FOOTER_SAFE_BOTTOM_REDUCTION
        : safeBottomHeight;
    const safeBottomOffset = disableKeyboardAnimation
      ? adjustedSafeBottomHeight
      : adjustedSafeBottomHeight * (1 - keyboardProgress.value);

    return {
      paddingBottom: keyboardOffset + safeBottomOffset,
    };
  });

  return (
    <Animated.View
      style={
        gtMd || !platformEnv.isNative ? undefined : animatedStyle
      }
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
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      footerRef.current.props = undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      footerRef.current.notifyUpdate?.();
    };
  }, [footerRef, props]);
  return null;
}

export function BasicPageFooter() {
  const { footerRef } = useContext(PageContext);
  const [, setCount] = useState(0);
  const { props: footerProps } = footerRef.current;
  useEffect(() => {
    footerRef.current.notifyUpdate = () => {
      setCount((i) => i + 1);
    };
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      footerRef.current.notifyUpdate = undefined;
    };
  }, [footerRef]);

  return footerProps ? (
    <PageFooterContainer
      disableKeyboardAnimation={footerProps?.disableKeyboardAnimation ?? false}
      hasDefaultFooterActions={!footerProps.children}
    >
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
