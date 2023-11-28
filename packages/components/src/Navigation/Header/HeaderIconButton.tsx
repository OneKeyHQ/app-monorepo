import { IconButton } from '../../IconButton';

import type { IIconButtonProps } from '../../IconButton';

function HeaderIconButton(props: IIconButtonProps) {
  return <IconButton variant="tertiary" focusStyle={undefined} {...props} />;
}

export default HeaderIconButton;
