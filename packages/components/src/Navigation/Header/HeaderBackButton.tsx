import { memo } from 'react';

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
  const showCollapseButton = isRootScreen && !isVerticalLayout;
  const showBackButton = canGoBack || showCloseButton;

  const renderBackButton = () => {
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
    return null;
  };

  const renderCollapseButton = () =>
    showCollapseButton ? (
      <HeaderCollapseButton isRootScreen={isRootScreen} />
    ) : null;

  // If neither button should be shown, return null early.
  if (!showCollapseButton && !showBackButton) {
    return null;
  }

  return (
    <HeaderButtonGroup mr="$4">
      {renderCollapseButton()}
      {!disableClose && renderBackButton()}
    </HeaderButtonGroup>
  );
}

export default memo(HeaderBackButton);
