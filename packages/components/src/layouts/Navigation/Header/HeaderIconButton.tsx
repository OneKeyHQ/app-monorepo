import { IconButton } from '../../../actions/IconButton';

import type { IIconButtonProps } from '../../../actions/IconButton';

const headerTooltipProps = {
  placement: 'bottom',
} as const;

function HeaderIconButton(props: IIconButtonProps) {
  return (
    <IconButton
      tooltipProps={headerTooltipProps}
      variant="tertiary"
      focusVisibleStyle={undefined}
      {...props}
    />
  );
}

export default HeaderIconButton;
