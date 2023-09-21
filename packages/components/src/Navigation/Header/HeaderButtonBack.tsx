import { useCallback, useMemo } from 'react';

// import { HeaderBackButton } from '@react-navigation/elements';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';

import HeaderButtonGroup from './HeaderButtonGroup';
import HeaderButtonIcon from './HeaderButtonIcon';
import HeaderButtonSide from './HeaderButtonSide';

import type { OneKeyStackHeaderProps } from './HeaderScreenOptions';
import type { HeaderBackButtonProps } from '@react-navigation/elements';

export default function HeaderButtonBack({
  isModelScreen,
  isRootScreen,
  canGoBack,
  ...props
}: OneKeyStackHeaderProps & HeaderBackButtonProps) {
  const isVerticalLayout = useIsVerticalLayout();

  const showCloseButton = isModelScreen && !isRootScreen && !canGoBack;
  const showSlideButton = isRootScreen && !isVerticalLayout;
  const showBackButton = canGoBack || showCloseButton;

  const backImageCallback = useCallback(() => {
    if (canGoBack) {
      return (
        <HeaderButtonIcon onPress={props.onPress} name="ChevronLeftOutline" />
      );
    }
    if (showCloseButton) {
      return (
        <HeaderButtonIcon onPress={props.onPress} name="CrossedLargeOutline" />
      );
    }
  }, [canGoBack, props.onPress, showCloseButton]);

  const backButtonMemo = useMemo(() => {
    if (showBackButton === false) return null;

    // if (platformEnv.isNativeIOS) {
    //   return (
    //     <HeaderBackButton
    //       testID="Navigation-HeaderBackButton"
    //       {...props}
    //       backImage={backImageCallback}
    //     />
    //   );
    // }

    return backImageCallback();
  }, [backImageCallback, showBackButton]);

  const slideButtonMemo = useMemo(() => {
    if (!showSlideButton) return null;

    return <HeaderButtonSide />;
  }, [showSlideButton]);

  return (
    <HeaderButtonGroup>
      {slideButtonMemo}
      {backButtonMemo}
    </HeaderButtonGroup>
  );
}
