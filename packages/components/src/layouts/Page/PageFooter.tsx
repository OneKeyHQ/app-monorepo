import type { PropsWithChildren } from 'react';
import { memo, useContext, useEffect, useMemo, useState } from 'react';

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useReanimatedKeyboardAnimation } from '../../hooks/useKeyboardController';
import { OptimizationView } from '../../optimization';

import {
  usePageFooterSafeAreaBottom,
  usePageFooterTabBarHeight,
  useSafeAreaBottom,
} from './hooks';
import { PageContext } from './PageContext';
import { FooterActions } from './PageFooterActions';

import type { IPageFooterProps, IPageFooterSafeAreaBottomMode } from './type';

// The default FooterActions already adds $5 (20) of bottom padding. Subtracting
// 10 preserves its existing visual gap above native system UI.
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
  safeAreaBottomMode,
}: PropsWithChildren & {
  disableKeyboardAnimation: boolean;
  hasDefaultFooterActions: boolean;
  safeAreaBottomMode: IPageFooterSafeAreaBottomMode;
}) => {
  const footerSafeBottomHeight = usePageFooterSafeAreaBottom();
  const tabBarHeight = usePageFooterTabBarHeight();
  const { height: keyboardHeight, progress: keyboardProgress } =
    useReanimatedKeyboardAnimation();
  const { gtMd } = useMedia();
  const containerOwnsSafeBottom = safeAreaBottomMode === 'container';

  const animatedStyle = useAnimatedStyle(() => {
    const keyboardAnimationDisabled = disableKeyboardAnimation || gtMd;
    const keyboardOffset = keyboardAnimationDisabled
      ? 0
      : Math.max(Math.abs(keyboardHeight.value) - tabBarHeight, 0);
    const safeBottomHeight = containerOwnsSafeBottom
      ? footerSafeBottomHeight
      : 0;
    const adjustedSafeBottomHeight =
      hasDefaultFooterActions &&
      safeBottomHeight > DEFAULT_FOOTER_SAFE_BOTTOM_REDUCTION
        ? safeBottomHeight - DEFAULT_FOOTER_SAFE_BOTTOM_REDUCTION
        : safeBottomHeight;
    const safeBottomOffset = keyboardAnimationDisabled
      ? adjustedSafeBottomHeight
      : adjustedSafeBottomHeight * (1 - keyboardProgress.value);
    // Content-owned footers keep the raw inset in their children. Once the
    // keyboard covers that region, remove it from the parent's keyboard
    // movement so the inset is not counted twice.
    const contentSafeBottomCompensation =
      !keyboardAnimationDisabled && !containerOwnsSafeBottom
        ? footerSafeBottomHeight * keyboardProgress.value
        : 0;

    return {
      paddingBottom:
        keyboardOffset + safeBottomOffset - contentSafeBottomCompensation,
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

  if (!footerProps) {
    return <Placeholder />;
  }

  const {
    children,
    disableKeyboardAnimation = false,
    safeAreaBottomMode = 'container',
    ...footerActionsProps
  } = footerProps;
  const hasDefaultFooterActions = !children;

  return (
    <PageFooterContainer
      disableKeyboardAnimation={disableKeyboardAnimation}
      hasDefaultFooterActions={hasDefaultFooterActions}
      safeAreaBottomMode={safeAreaBottomMode}
    >
      {children || <FooterActions {...footerActionsProps} />}
    </PageFooterContainer>
  );
}

export const PageFooter = memo(PageFooterContext);
