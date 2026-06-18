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
      // The iOS 26 Liquid Glass treatment (reset negative margin, strip
      // self-drawn background/press, raise icon contrast) is handled inside
      // IconButton via the GlassHeaderContext, so it only applies when this
      // button is actually injected into the native glass bar.
      {...props}
    />
  );
}

export default HeaderIconButton;
