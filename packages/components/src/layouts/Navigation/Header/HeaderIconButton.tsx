import { IconButton } from '../../../actions/IconButton';

import type { IIconButtonProps } from '../../../actions/IconButton';

function HeaderIconButton(props: IIconButtonProps) {
  return (
    <IconButton
      tooltipProps={{
        placement: 'bottom',
      }}
      variant="tertiary"
      focusVisibleStyle={undefined}
      {...props}
    />
  );
}

export default HeaderIconButton;
