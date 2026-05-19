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
      {...props}
    />
  );
}

export default HeaderIconButton;
