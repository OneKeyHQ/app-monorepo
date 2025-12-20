import { memo } from 'react';

import { Divider } from '../../content';
import { useIsWebHorizontalLayout } from '../../hooks';

import type { IStackStyle } from '../../primitives';

function BasicPageHeaderDivider(props: IStackStyle) {
  const isHorizontal = useIsWebHorizontalLayout();
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
