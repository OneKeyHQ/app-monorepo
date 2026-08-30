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
// 10 keeps a 10-unit visual gap above Android system UI.
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
  // Custom footers keep ownership of their safe-area spacing.
  const shouldApplyAndroidSafeBottom =
    platformEnv.isNativeAndroid && hasDefaultFooterActions;

  const animatedStyle = useAnimatedStyle(() => {
    const keyboardAnimationDisabled = disableKeyboardAnimation || gtMd;
    const keyboardOffset = keyboardAnimationDisabled
      ? 0
      : Math.max(Math.abs(keyboardHeight.value) - tabBarHeight, 0);
    const androidSafeBottomHeight = shouldApplyAndroidSafeBottom
      ? safeBottomHeight
      : 0;
    const adjustedSafeBottomHeight =
      hasDefaultFooterActions &&
      androidSafeBottomHeight > DEFAULT_FOOTER_SAFE_BOTTOM_REDUCTION
        ? androidSafeBottomHeight - DEFAULT_FOOTER_SAFE_BOTTOM_REDUCTION
        : androidSafeBottomHeight;
    const safeBottomOffset = keyboardAnimationDisabled
      ? adjustedSafeBottomHeight
      : adjustedSafeBottomHeight * (1 - keyboardProgress.value);

    return {
      paddingBottom: keyboardOffset + safeBottomOffset,
    };
  });

  return (
    <Animated.View style={platformEnv.isNative ? animatedStyle : undefined}>
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

  const hasDefaultFooterActions = !footerProps?.children;

  return footerProps ? (
    <PageFooterContainer
      disableKeyboardAnimation={footerProps?.disableKeyboardAnimation ?? false}
      hasDefaultFooterActions={hasDefaultFooterActions}
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
