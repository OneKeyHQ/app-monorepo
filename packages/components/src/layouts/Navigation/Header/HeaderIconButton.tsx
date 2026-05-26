import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../../actions/IconButton';

import type { IIconButtonProps } from '../../../actions/IconButton';

const headerTooltipProps = {
  placement: 'bottom',
} as const;

function HeaderIconButton(props: IIconButtonProps) {
  return (
    // testID flows through {...props} so the caller picks it.
    // oxlint-disable-next-line onekey/require-testid
    <IconButton
      tooltipProps={headerTooltipProps}
      variant="tertiary"
      focusVisibleStyle={undefined}
      className="app-region-no-drag"
      // IconButton's tertiary variant applies a negative margin (m: -7)
      // intended for inline text alignment. On iOS 26 the navigation bar
      // wraps headerLeft/right in a glass container that vertically
      // centers the view's frame; the negative margin then shifts the
      // visible icon up and to the left of that centered slot. Reset it
      // for header use so the icon sits at the bar's true center.
      {...(platformEnv.isNativeIOS26Plus && { m: 0 })}
      {...props}
    />
  );
}

export default HeaderIconButton;
