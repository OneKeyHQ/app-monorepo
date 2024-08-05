import { IconButton } from '../../../actions';

import type { IIconButtonProps } from '../../../actions';

function HeaderIconButton(props: IIconButtonProps) {
  return (
    <IconButton variant="tertiary" focusVisibleStyle={undefined} {...props} />
  );
}

export default HeaderIconButton;
