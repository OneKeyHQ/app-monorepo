import type { ReactNode } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { type IIconButtonProps } from '../../../actions';

import HeaderButtonGroup from './HeaderButtonGroup';
import HeaderCollapseButton, {
  useHeaderCollapseButtonVisibility,
} from './HeaderCollapseButton';
import HeaderIconButton from './HeaderIconButton';

import type { IOnekeyStackHeaderProps } from './HeaderScreenOptions';
import type { HeaderBackButtonProps } from '@react-navigation/elements';

type INavButtonProps = Omit<IIconButtonProps, 'icon' | 'testID'>;

export function NavBackButton(props: INavButtonProps) {
  return (
    <HeaderIconButton
      icon="ChevronLeftOutline"
      {...(platformEnv.isNativeIOS && { pressStyle: undefined })}
      testID="nav-header-back"
      {...props}
    />
  );
}

export function NavCloseButton(props: INavButtonProps) {
  return (
    <HeaderIconButton
      icon="CrossedLargeOutline"
      testID="nav-header-close"
      {...props}
    />
  );
}

function HeaderBackButton({
  isModelScreen,
  isRootScreen,
  canGoBack,
  renderLeft,
  ...props
}: IOnekeyStackHeaderProps &
  HeaderBackButtonProps & {
    renderLeft?: (props: any) => ReactNode | undefined;
    canGoBack?: boolean;
  }) {
  const isVerticalLayout = useMedia().md;

  const showCloseButton = isModelScreen && !isRootScreen && !canGoBack;
  const showCollapseButton = isRootScreen && !isVerticalLayout;
  const showBackButton = canGoBack || showCloseButton;

  const headerCollapseButtonProps = useMemo(
    () => ({
      hideWhenOpen: true,
    }),
    [],
  );

  const { shouldHide: shouldHideCollapseButton } =
    useHeaderCollapseButtonVisibility(headerCollapseButtonProps);

  const renderBackButton = () => {
    if (canGoBack) {
      return <NavBackButton onPress={props.onPress} />;
    }
    if (showCloseButton) {
      return <NavCloseButton onPress={props.onPress} />;
    }
    return null;
  };

  const renderCollapseButton = useCallback(
    () =>
      showCollapseButton ? (
        <HeaderCollapseButton
          {...headerCollapseButtonProps}
          isRootScreen={isRootScreen}
        />
      ) : null,
    [showCollapseButton, headerCollapseButtonProps, isRootScreen],
  );

  // If neither button should be shown, return null early.
  if (!showCollapseButton && !showBackButton && !renderLeft) {
    return null;
  }

  if (showCollapseButton && !showBackButton && !renderLeft) {
    if (shouldHideCollapseButton) {
      return null;
    }
  }

  return (
    <HeaderButtonGroup mr="$4">
      {renderCollapseButton()}
      {!renderLeft ? renderBackButton() : null}
      {renderLeft
        ? renderLeft({
            canGoBack,
            ...props,
          })
        : null}
    </HeaderButtonGroup>
  );
}

export default memo(HeaderBackButton);
