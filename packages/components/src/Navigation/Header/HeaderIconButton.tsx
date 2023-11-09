import { IconButton } from '../../IconButton';

import type { IIconButtonProps } from '../../IconButton';

function HeaderIconButton(props: IIconButtonProps) {
  return <IconButton variant="tertiary" {...props} />;
}

export default HeaderIconButton;
