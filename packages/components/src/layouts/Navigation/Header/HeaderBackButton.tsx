import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { useMedia } from 'tamagui';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { type IIconButtonProps, Shortcut, Tooltip } from '../../../actions';
import { XStack } from '../../../primitives';

import HeaderButtonGroup from './HeaderButtonGroup';
import HeaderCollapseButton from './HeaderCollapseButton';
import HeaderIconButton from './HeaderIconButton';

import type { IOnekeyStackHeaderProps } from './HeaderScreenOptions';
import type { HeaderBackButtonProps } from '@react-navigation/elements/src/types';

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
  const intl = useIntl();
  const title = useMemo(
    () => (
      <XStack>
        <Tooltip.Text>
          {intl.formatMessage({ id: ETranslations.global_close })}
        </Tooltip.Text>
        {!platformEnv.isExtensionUiPopup ? (
          <Shortcut pl="$2">
            <Shortcut.Key>ESC</Shortcut.Key>
          </Shortcut>
        ) : null}
      </XStack>
    ),
    [intl],
  );
  return (
    <HeaderIconButton
      title={title}
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
  disableClose,
  renderLeft,
  ...props
}: IOnekeyStackHeaderProps &
  HeaderBackButtonProps & {
    renderLeft?: (props: any) => ReactNode | undefined;
  }) {
  const isVerticalLayout = useMedia().md;

  const showCloseButton = isModelScreen && !isRootScreen && !canGoBack;
  const showCollapseButton = isRootScreen && !isVerticalLayout;
  const showBackButton = canGoBack || showCloseButton;

  const renderBackButton = () => {
    if (canGoBack) {
      return <NavBackButton onPress={props.onPress} />;
    }
    if (showCloseButton) {
      return <NavCloseButton onPress={props.onPress} />;
    }
    return null;
  };

  const renderCollapseButton = () =>
    showCollapseButton ? (
      <HeaderCollapseButton isRootScreen={isRootScreen} />
    ) : null;

  // If neither button should be shown, return null early.
  if (!showCollapseButton && !showBackButton && !renderLeft) {
    return null;
  }

  return (
    <HeaderButtonGroup mr="$4">
      {renderCollapseButton()}
      {!disableClose && !renderLeft ? renderBackButton() : null}
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
