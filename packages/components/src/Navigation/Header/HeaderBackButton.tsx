import { memo, useCallback, useMemo } from 'react';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';

import HeaderButtonGroup from './HeaderButtonGroup';
import HeaderCollapseButton from './HeaderCollapseButton';
import HeaderIconButton from './HeaderIconButton';

import type { IOnekeyStackHeaderProps } from './HeaderScreenOptions';
import type { HeaderBackButtonProps } from '@react-navigation/elements';

function HeaderBackButton({
  isModelScreen,
  isRootScreen,
  canGoBack,
  disableClose,
  ...props
}: IOnekeyStackHeaderProps & HeaderBackButtonProps) {
  const isVerticalLayout = useIsVerticalLayout();

  const showCloseButton = isModelScreen && !isRootScreen && !canGoBack;
  const showSlideButton = isRootScreen && !isVerticalLayout;
  const showBackButton = canGoBack || showCloseButton;

  const backImageCallback = useCallback(() => {
    if (canGoBack) {
      return (
        <HeaderIconButton onPress={props.onPress} icon="ChevronLeftOutline" />
      );
    }
    if (showCloseButton) {
      return (
        <HeaderIconButton onPress={props.onPress} icon="CrossedLargeOutline" />
      );
    }
  }, [canGoBack, props.onPress, showCloseButton]);

  const backButtonMemo = useMemo(() => {
    if (showBackButton === false) return null;

    return backImageCallback();
  }, [backImageCallback, showBackButton]);

  const slideButtonMemo = useMemo(() => {
    if (!showSlideButton) return null;

    return <HeaderCollapseButton isRootScreen={isRootScreen} />;
  }, [isRootScreen, showSlideButton]);

  return (
    <HeaderButtonGroup>
      {slideButtonMemo}
      {!disableClose && backButtonMemo}
    </HeaderButtonGroup>
  );
}

export default memo(HeaderBackButton);
