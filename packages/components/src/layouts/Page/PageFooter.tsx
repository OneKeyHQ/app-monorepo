import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import {
  Children,
  isValidElement,
  memo,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useReanimatedKeyboardAnimation } from '../../hooks/useKeyboardController';
import { OptimizationView } from '../../optimization';

import { useSafeAreaBottom, useTabBarHeight } from './hooks';
import { PageContext } from './PageContext';
import { FooterActions, type IFooterActionsProps } from './PageFooterActions';

import type { IPageFooterProps } from './type';

// The default FooterActions already adds $5 (20) of bottom padding. Subtracting
// 10 keeps a 10-unit visual gap above Android system UI.
const DEFAULT_FOOTER_SAFE_BOTTOM_REDUCTION = 10;

function findFooterActionsElement(
  children: ReactNode,
): ReactElement<IFooterActionsProps> | undefined {
  for (const child of Children.toArray(children)) {
    if (isValidElement(child)) {
      if (child.type === FooterActions) {
        return child as ReactElement<IFooterActionsProps>;
      }
      const nestedFooterActions = findFooterActionsElement(
        (child.props as PropsWithChildren).children,
      );
      if (nestedFooterActions) {
        return nestedFooterActions;
      }
    }
  }
  return undefined;
}

function hasNumericBottomSpacing(children: ReactNode): boolean {
  for (const child of Children.toArray(children)) {
    if (isValidElement(child)) {
      const { children: nestedChildren, mb, marginBottom, paddingBottom, pb } =
        child.props as PropsWithChildren<IFooterActionsProps>;
      if (
        [mb, marginBottom, paddingBottom, pb].some(
          (value) => typeof value === 'number' && value > 0,
        ) ||
        hasNumericBottomSpacing(nestedChildren)
      ) {
        return true;
      }
    }
  }
  return false;
}

const Placeholder = () => {
  const bottom = useSafeAreaBottom();
  const style = useMemo(() => ({ height: bottom }), [bottom]);
  return bottom > 0 ? <OptimizationView style={style} /> : null;
};

const PageFooterContainer = ({
  children,
  disableKeyboardAnimation,
  hasFooterActions,
  shouldManageSafeBottom,
}: PropsWithChildren & {
  disableKeyboardAnimation: boolean;
  hasFooterActions: boolean;
  shouldManageSafeBottom: boolean;
}) => {
  // Footer safe-area ownership is independent from the Page body. Some pages
  // disable body safe area because their scroll view already handles it.
  const safeBottomHeight = useSafeAreaBottom(shouldManageSafeBottom);
  const tabBarHeight = useTabBarHeight();
  const { height: keyboardHeight, progress: keyboardProgress } =
    useReanimatedKeyboardAnimation();
  const { gtMd } = useMedia();
  const shouldApplyAndroidSafeBottom =
    platformEnv.isNativeAndroid && shouldManageSafeBottom;

  const animatedStyle = useAnimatedStyle(() => {
    const keyboardAnimationDisabled = disableKeyboardAnimation || gtMd;
    const keyboardOffset = keyboardAnimationDisabled
      ? 0
      : Math.max(Math.abs(keyboardHeight.value) - tabBarHeight, 0);
    const androidSafeBottomHeight = shouldApplyAndroidSafeBottom
      ? safeBottomHeight
      : 0;
    const adjustedSafeBottomHeight =
      hasFooterActions &&
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

  const footerActionsElement = footerProps?.children
    ? findFooterActionsElement(footerProps.children)
    : undefined;
  const hasFooterActions = !footerProps?.children || !!footerActionsElement;
  // Numeric bottom spacing is treated as caller-owned safe-area handling;
  // token spacing remains design padding and still receives the shared inset.
  const shouldManageSafeBottom =
    footerProps?.safeAreaEnabled !== false &&
    !hasNumericBottomSpacing(footerProps?.children);

  return footerProps ? (
    <PageFooterContainer
      disableKeyboardAnimation={footerProps?.disableKeyboardAnimation ?? false}
      hasFooterActions={hasFooterActions}
      shouldManageSafeBottom={shouldManageSafeBottom}
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
