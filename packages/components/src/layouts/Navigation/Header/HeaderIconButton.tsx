import { IconButton } from '../../../actions';

import type { IIconButtonProps } from '../../../actions';

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
