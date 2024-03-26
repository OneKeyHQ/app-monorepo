import type { PropsWithChildren } from 'react';
import { memo, useContext, useEffect, useMemo, useState } from 'react';

import Animated from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, usePageType } from '../../hocs';
import { useSafeAreaInsets } from '../../hooks';
import { View } from '../../optimization';

import { useSafeKeyboardAnimationStyle } from './hooks';
import { PageContext } from './PageContext';
import { FooterActions } from './PageFooterActions';

import type { IPageFooterProps } from './type';

const useSafeAreaBottom = () => {
  const pageType = usePageType();
  const { safeAreaEnabled } = useContext(PageContext);
  const { bottom } = useSafeAreaInsets();
  return safeAreaEnabled && pageType === EPageType.modal ? bottom : 0;
};

const Placeholder = () => {
  const bottom = useSafeAreaBottom();
  return bottom > 0 ? <View style={{ height: bottom }} /> : null;
};

const PageFooterContainer = ({ children }: PropsWithChildren) => {
  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();
  return (
    <Animated.View style={safeKeyboardAnimationStyle}>{children}</Animated.View>
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
