import { IconButton } from '../../../actions';

import type { IIconButtonProps } from '../../../actions';

function HeaderIconButton(props: IIconButtonProps) {
  return <IconButton variant="tertiary" focusStyle={undefined} {...props} />;
}

export default HeaderIconButton;
