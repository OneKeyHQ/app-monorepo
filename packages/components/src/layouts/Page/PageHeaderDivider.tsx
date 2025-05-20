import { memo } from 'react';

import { Divider } from '../../content';
import { useIsHorizontalLayout } from '../../hooks';

import type { IStackStyle } from '../../primitives';

function BasicPageHeaderDivider(props: IStackStyle) {
  const isHorizontal = useIsHorizontalLayout();
  return isHorizontal ? (
    <Divider
      $platform-web={{
        transform: 'none',
      }}
      {...props}
    />
  ) : null;
}

export const PageHeaderDivider = memo(BasicPageHeaderDivider);
